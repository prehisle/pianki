import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';

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
  try {
    // 解压.apkg文件
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(apkgBuffer);

    // 查找collection文件
    const collectionFile = zipContent.file('collection.anki2') || zipContent.file('collection.anki21');

    if (!collectionFile) {
      throw new Error('无效的.apkg文件：找不到collection数据库');
    }

    // 读取SQLite数据库
    const dbBuffer = await collectionFile.async('nodebuffer');

    // 动态导入sql.js
    // @ts-ignore - sql.js没有类型定义
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
    const db = new SQL.Database(new Uint8Array(dbBuffer));

    // 提取牌组名称
    const deckNameResult = db.exec('SELECT decks FROM col');
    let deckName = '导入的牌组';

    if (deckNameResult.length > 0 && deckNameResult[0].values.length > 0) {
      try {
        const decksJson = JSON.parse(deckNameResult[0].values[0][0] as string);
        const deckIds = Object.keys(decksJson).filter(id => id !== '1'); // 排除默认牌组
        if (deckIds.length > 0) {
          deckName = decksJson[deckIds[0]].name || '导入的牌组';
        }
      } catch (e) {
        console.error('解析牌组名称失败:', e);
      }
    }

    // 提取笔记和卡片
    const notesResult = db.exec('SELECT id, flds FROM notes');
    const cards: ImportedCard[] = [];

    if (notesResult.length > 0) {
      for (const row of notesResult[0].values) {
        const fields = (row[1] as string).split('\x1f'); // Anki使用\x1f分隔字段

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
    }

    db.close();

    return {
      name: deckName,
      cards
    };
  } catch (error) {
    console.error('导入.apkg文件失败:', error);
    throw new Error('导入失败: ' + (error as Error).message);
  }
}
