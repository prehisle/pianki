import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';
import { decompress as decompressZstd } from '@mongodb-js/zstd';

interface ImportedCard {
  guid?: string;
  front_text?: string;
  back_text?: string;
  front_image?: string;
  back_image?: string;
}

interface ImportedDeck {
  name: string;
  description?: string;
  cards: ImportedCard[];
}

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function bufferStartsWithZstdMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ZSTD_MAGIC);
}

async function maybeDecompress(buffer: Buffer): Promise<Buffer> {
  if (bufferStartsWithZstdMagic(buffer)) {
    try {
      return await decompressZstd(buffer);
    } catch (error) {
      console.error('Zstd解压失败，使用原始数据:', error);
    }
  }
  return buffer;
}

function decodeModernMediaMap(buffer: Buffer): Record<string, string> | null {
  try {
    const state = { offset: 0 };
    const entries: string[] = [];

    while (state.offset < buffer.length) {
      const tag = readVarint(buffer, state);
      if (tag === 0) {
        break;
      }
      const fieldNumber = tag >> 3;
      const wireType = tag & 7;

      if (fieldNumber === 1 && wireType === 2) {
        const length = readVarint(buffer, state);
        const end = state.offset + length;
        const entryState = { offset: state.offset };
        let name: string | null = null;

        while (entryState.offset < end) {
          const entryTag = readVarint(buffer, entryState);
          const entryField = entryTag >> 3;
          const entryWire = entryTag & 7;

          switch (entryField) {
            case 1: {
              if (entryWire !== 2) {
                skipField(buffer, entryState, entryWire);
                break;
              }
              const len = readVarint(buffer, entryState);
              name = buffer
                .subarray(entryState.offset, entryState.offset + len)
                .toString('utf8');
              entryState.offset += len;
              break;
            }
            case 2: {
              // size (unused currently)
              if (entryWire !== 0) {
                skipField(buffer, entryState, entryWire);
                break;
              }
              readVarint(buffer, entryState);
              break;
            }
            case 3: {
              // sha1 bytes
              if (entryWire !== 2) {
                skipField(buffer, entryState, entryWire);
                break;
              }
              const len = readVarint(buffer, entryState);
              entryState.offset += len;
              break;
            }
            default:
              skipField(buffer, entryState, entryWire);
          }
        }

        entries.push(name ?? '');
        state.offset = end;
      } else {
        skipField(buffer, state, wireType);
      }
    }

    const mapping: Record<string, string> = {};
    entries.forEach((value, index) => {
      if (value) {
        mapping[String(index)] = value;
      }
    });
    return Object.keys(mapping).length > 0 ? mapping : null;
  } catch (error) {
    console.error('解析现代媒体映射失败:', error);
    return null;
  }
}

function readVarint(buffer: Buffer, state: { offset: number }): number {
  let shift = 0;
  let result = 0;

  while (state.offset < buffer.length) {
    const byte = buffer[state.offset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return result >>> 0;
    }
    shift += 7;
  }

  throw new Error('读取Varint时超过缓冲区范围');
}

function skipField(buffer: Buffer, state: { offset: number }, wireType: number): void {
  switch (wireType) {
    case 0: // varint
      readVarint(buffer, state);
      break;
    case 1: // 64-bit
      state.offset += 8;
      break;
    case 2: { // length-delimited
      const length = readVarint(buffer, state);
      state.offset += length;
      break;
    }
    case 5: // 32-bit
      state.offset += 4;
      break;
    default:
      throw new Error(`未知的wire类型: ${wireType}`);
  }
}

export async function importFromAnki(apkgBuffer: Buffer, uploadsDir: string): Promise<ImportedDeck> {
  let tempDbPath: string | null = null;

  try {
    // 解压.apkg文件
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(apkgBuffer);

    // 读取媒体文件映射
    const mediaMapping: Record<string, string> = {};
    const mediaFile = zipContent.file('media');

    if (mediaFile) {
      try {
        const rawMediaBuffer = Buffer.from(await mediaFile.async('nodebuffer'));
        const candidateBuffers: Buffer[] = [rawMediaBuffer];

        if (bufferStartsWithZstdMagic(rawMediaBuffer)) {
          const decompressed = await maybeDecompress(rawMediaBuffer);
          if (decompressed !== rawMediaBuffer) {
            candidateBuffers.push(decompressed);
          }
        }

        const parseMediaJson = (buffer: Buffer) => {
          try {
            const content = buffer.toString('utf8');
            return JSON.parse(content) as Record<string, string>;
          } catch {
            return null;
          }
        };

        let mappingResolved = false;

        for (const buffer of candidateBuffers) {
          const mediaJson = parseMediaJson(buffer);
          if (mediaJson) {
            Object.assign(mediaMapping, mediaJson);
            mappingResolved = true;
            break;
          }
        }

        if (!mappingResolved) {
          for (const buffer of candidateBuffers) {
            const modernMap = decodeModernMediaMap(buffer);
            if (modernMap) {
              Object.assign(mediaMapping, modernMap);
              mappingResolved = true;
              break;
            }
          }
        }

        if (!mappingResolved) {
          console.error('读取媒体映射失败: 无法解析媒体映射数据');
        }
      } catch (e) {
        console.error('读取媒体映射失败:', e);
      }
    }

    // 查找collection文件（优先使用新版的 zstd 压缩数据库）
    const collectionCandidates: Array<{
      name: string;
      decompress: 'zstd' | null;
    }> = [
      { name: 'collection.anki21b', decompress: 'zstd' },
      // 旧版兼容文件
      { name: 'collection.anki21', decompress: null },
      { name: 'collection.anki2', decompress: null }
    ];

    let collectionFile: JSZip.JSZipObject | null = null;
    let decompressMode: 'zstd' | null = null;

    for (const candidate of collectionCandidates) {
      const file = zipContent.file(candidate.name);
      if (file) {
        collectionFile = file;
        decompressMode = candidate.decompress;
        break;
      }
    }

    if (!collectionFile) {
      throw new Error('无效的.apkg文件：找不到collection数据库');
    }

    // 读取SQLite数据库并保存为临时文件
    const rawDbBuffer = await collectionFile.async('nodebuffer');
    const dbBuffer =
      decompressMode === 'zstd' ? await decompressZstd(Buffer.from(rawDbBuffer)) : Buffer.from(rawDbBuffer);
    tempDbPath = path.join(uploadsDir, `temp_${Date.now()}.db`);
    await fs.writeFile(tempDbPath, dbBuffer);

    // 使用better-sqlite3打开数据库
    const db = new Database(tempDbPath, { readonly: true });

    // 提取牌组名称
    let deckName = '导入的牌组';
    try {
      const colRow = db.prepare('SELECT decks FROM col').get() as { decks: string } | undefined;
      if (colRow && colRow.decks && colRow.decks.trim().length > 2) {
        const decksJson = JSON.parse(colRow.decks);
        const deckIds = Object.keys(decksJson).filter(id => id !== '1'); // 排除默认牌组
        if (deckIds.length > 0) {
          deckName = decksJson[deckIds[0]].name || '导入的牌组';
        }
      } else {
        const deckRow = db
          .prepare('SELECT name FROM decks WHERE id != 1 ORDER BY id LIMIT 1')
          .get() as { name: string } | undefined;
        if (deckRow?.name) {
          deckName = deckRow.name;
        }
      }
    } catch (e) {
      console.error('解析牌组名称失败:', e);
    }

    // 提取笔记和卡片
    const processField = async (field: string): Promise<{ text?: string; image?: string }> => {
      let imagePath: string | undefined;

      const imgRegex = /<img[^>]+src="([^"]+)"/i;
      const srcMatch = imgRegex.exec(field);

      if (srcMatch) {
        const imageName = srcMatch[1];
        let actualFileName: string | null = null;

        for (const [numKey, originalName] of Object.entries(mediaMapping)) {
          if (originalName === imageName) {
            actualFileName = numKey;
            break;
          }
        }

        if (!actualFileName) {
          actualFileName = imageName;
        }

        const imageFile = zipContent.file(actualFileName);

        if (imageFile) {
          try {
            const imageBuffer = await maybeDecompress(Buffer.from(await imageFile.async('nodebuffer')));
            const ext = path.extname(imageName) || path.extname(actualFileName);
            const newFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            const fullPath = path.join(uploadsDir, newFileName);
            await fs.writeFile(fullPath, imageBuffer);
            imagePath = `/uploads/${newFileName}`;
          } catch (e) {
            console.error('保存图片失败:', e);
          }
        }
      }

      const withoutStyles = field.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      const textWithBreaks = withoutStyles.replace(/<br\s*\/?>/gi, '\n');
      const text = textWithBreaks
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\r/g, '')
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map(part => part.trim())
        .filter(Boolean)
        .join('\n')
        .trim();

      const attributeOnlyPattern = /^(width|height)="[^"]+"$/i;

      const result: { text?: string; image?: string } = {};
      if (text && !attributeOnlyPattern.test(text)) {
        result.text = text;
      }
      if (imagePath) {
        result.image = imagePath;
      }
      return result;
    };

    const resolveFieldNames = () => {
      const fieldNameMap = new Map<number, string[]>();
      const hasFieldsTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fields'")
        .get() as { name: string } | undefined;

      if (hasFieldsTable) {
        const fieldRows = db
          .prepare('SELECT ntid as noteTypeId, ord, name FROM fields ORDER BY ntid, ord')
          .all() as Array<{ noteTypeId: number; ord: number; name: string }>;

        for (const row of fieldRows) {
          if (!fieldNameMap.has(row.noteTypeId)) {
            fieldNameMap.set(row.noteTypeId, []);
          }
          fieldNameMap.get(row.noteTypeId)![row.ord] = row.name?.trim() ?? '';
        }
        return fieldNameMap;
      }

      const colRow = db
        .prepare('SELECT models FROM col LIMIT 1')
        .get() as { models?: string } | undefined;

      if (!colRow?.models) {
        return fieldNameMap;
      }

      try {
        const models = JSON.parse(colRow.models) as Record<
          string,
          { id?: number; name?: string; flds?: Array<{ name?: string }> }
        >;
        Object.values(models).forEach(model => {
          const modelId = Number(model?.id);
          if (!Number.isFinite(modelId)) {
            return;
          }
          const names =
            Array.isArray(model?.flds) && model.flds.length > 0
              ? model.flds.map(f => (f?.name ?? '').trim())
              : [];
          fieldNameMap.set(modelId, names);
        });
      } catch (err) {
        console.warn('解析 Anki 模板字段名称失败，将使用默认字段顺序:', err);
      }

      return fieldNameMap;
    };

    const fieldNameMap = resolveFieldNames();

    const notes = db
      .prepare('SELECT id, guid, flds, mid FROM notes')
      .all() as Array<{ id: number; guid: string; flds: string; mid: number }>;
    const cards: ImportedCard[] = [];

    for (const note of notes) {
      const fields = note.flds.split('\x1f'); // Anki使用\x1f分隔字段
      const fieldNames = fieldNameMap.get(note.mid) ?? [];
      const processedFields: Array<{ text?: string; image?: string }> = [];

      for (const field of fields) {
        const processed = await processField(field || '');
        processedFields.push(processed);
      }

      const frontTextParts: string[] = [];
      const backTextParts: string[] = [];
      let frontImage: string | undefined;
      let backImage: string | undefined;

      const pushText = (target: 'front' | 'back', text: string, label?: string) => {
        const labelled =
          label && label !== 'Front'
            ? `${label.trim().replace(/[:：]\s*$/, '')}: ${text}`
            : text;
        if (target === 'front') {
          frontTextParts.push(labelled);
        } else {
          backTextParts.push(labelled);
        }
      };

      processedFields.forEach((processed, index) => {
        const labelRaw = (fieldNames[index] ?? '').trim();
        const label = labelRaw || undefined;
        const labelNormalized = labelRaw.toLowerCase();
        const isBackLabel = /back|answer|反面|答案/.test(labelNormalized);
        const isFrontLabel = /front|question|正面|题面/.test(labelNormalized);
        const text = processed.text;
        if (text) {
          const normalizedText = text.trim();
          if (normalizedText) {
            let target: 'front' | 'back';

            if (isBackLabel) {
              target = 'back';
            } else if (isFrontLabel) {
              target = 'front';
            } else if (index === 0) {
              target = 'front';
            } else if (index === 1) {
              target = 'back';
            } else {
              target = frontTextParts.length === 0 ? 'front' : 'back';
            }

            if (
              target === 'front' &&
              (frontTextParts.length > 0 && (isBackLabel || normalizedText.length > 120 || index > 0))
            ) {
              target = 'back';
            }

            pushText(target, normalizedText, label);
          }
        }

        if (processed.image) {
          if (!frontImage) {
            frontImage = processed.image;
          } else if (!backImage) {
            backImage = processed.image;
          }
        }
      });

      const frontText = frontTextParts.join('\n').trim();
      const backText = backTextParts.join('\n\n').trim();

      cards.push({
        guid: note.guid,
        front_text: frontText || undefined,
        front_image: frontImage,
        back_text: backText || undefined,
        back_image: backImage
      });
    }

    // 关闭数据库
    db.close();

    // 清理临时数据库文件
    if (tempDbPath) {
      await fs.unlink(tempDbPath).catch(e => console.error('清理临时文件失败:', e));
    }

    return {
      name: deckName,
      cards
    };
  } catch (error) {
    // 清理临时数据库文件
    if (tempDbPath) {
      await fs.unlink(tempDbPath).catch(e => console.error('清理临时文件失败:', e));
    }
    console.error('导入.apkg文件失败:', error);
    throw new Error('导入失败: ' + (error as Error).message);
  }
}
