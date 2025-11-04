import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';

interface ImportedCard {
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

export async function importFromAnki(apkgBuffer: Buffer, uploadsDir: string): Promise<ImportedDeck> {
  let tempDbPath: string | null = null;

  try {
    // 解压.apkg文件
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(apkgBuffer);

    // 查找collection文件
    const collectionFile = zipContent.file('collection.anki2') || zipContent.file('collection.anki21');

    if (!collectionFile) {
      throw new Error('无效的.apkg文件：找不到collection数据库');
    }

    // 读取SQLite数据库并保存为临时文件
    const dbBuffer = await collectionFile.async('nodebuffer');
    tempDbPath = path.join(uploadsDir, `temp_${Date.now()}.db`);
    await fs.writeFile(tempDbPath, dbBuffer);

    // 使用better-sqlite3打开数据库
    const db = new Database(tempDbPath, { readonly: true });

    // 提取牌组名称
    let deckName = '导入的牌组';
    try {
      const colRow = db.prepare('SELECT decks FROM col').get() as { decks: string } | undefined;
      if (colRow && colRow.decks) {
        const decksJson = JSON.parse(colRow.decks);
        const deckIds = Object.keys(decksJson).filter(id => id !== '1'); // 排除默认牌组
        if (deckIds.length > 0) {
          deckName = decksJson[deckIds[0]].name || '导入的牌组';
        }
      }
    } catch (e) {
      console.error('解析牌组名称失败:', e);
    }

    // 提取笔记和卡片
    const notes = db.prepare('SELECT id, flds FROM notes').all() as Array<{ id: number; flds: string }>;
    const cards: ImportedCard[] = [];

    for (const note of notes) {
      const fields = note.flds.split('\x1f'); // Anki使用\x1f分隔字段

      // 处理图片引用
      const processField = async (field: string): Promise<{ text?: string; image?: string }> => {
        // 检查是否包含图片标签
        const imgRegex = /<img[^>]+src="([^"]+)"/g;
        const matches = field.match(imgRegex);

        if (matches) {
          // 提取图片文件名
          const srcMatch = /<img[^>]+src="([^"]+)"/.exec(field);
          if (srcMatch) {
            const imageName = srcMatch[1];
            const imageFile = zipContent.file(imageName);

            if (imageFile) {
              try {
                const imageBuffer = await imageFile.async('nodebuffer');
                const ext = path.extname(imageName);
                const newFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
                const imagePath = path.join(uploadsDir, newFileName);
                await fs.writeFile(imagePath, imageBuffer);
                return { image: `/uploads/${newFileName}` };
              } catch (e) {
                console.error('保存图片失败:', e);
              }
            }
          }
        }

        // 移除HTML标签，保留文本
        const text = field.replace(/<[^>]+>/g, '').trim();
        return text ? { text } : {};
      };

      // 处理正面和背面
      const front = await processField(fields[0] || '');
      const back = await processField(fields[1] || '');

      cards.push({
        front_text: front.text,
        front_image: front.image,
        back_text: back.text,
        back_image: back.image
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
