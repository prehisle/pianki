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

/**
 * 简化版的.apkg导入
 * 暂时不解析SQLite数据库，提供一个基础的导入功能
 * 用户可以导入后手动编辑卡片内容
 */
export async function importFromAnkiSimple(apkgBuffer: Buffer, uploadsDir: string): Promise<ImportedDeck> {
  try {
    // 解压.apkg文件
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(apkgBuffer);

    // 获取文件列表
    const files = Object.keys(zipContent.files);

    // 提取媒体文件
    const mediaFiles: string[] = [];
    for (const filename of files) {
      // 跳过数据库文件和目录
      if (filename.includes('collection') || zipContent.files[filename].dir) {
        continue;
      }

      // 处理媒体文件（图片等）
      const file = zipContent.files[filename];
      const ext = path.extname(filename).toLowerCase();

      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        try {
          const fileBuffer = await file.async('nodebuffer');
          const newFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
          const filePath = path.join(uploadsDir, newFileName);
          await fs.writeFile(filePath, fileBuffer);
          mediaFiles.push(`/uploads/${newFileName}`);
        } catch (e) {
          console.error('保存媒体文件失败:', filename, e);
        }
      }
    }

    // 创建空白卡片，用户可以手动填充
    // 根据媒体文件数量创建对应的卡片
    const cards: ImportedCard[] = [];

    if (mediaFiles.length > 0) {
      // 如果有图片，为每张图片创建一张卡片
      for (const mediaFile of mediaFiles) {
        cards.push({
          front_text: '请编辑卡片正面内容',
          back_text: '请编辑卡片背面内容',
          front_image: mediaFile
        });
      }
    } else {
      // 如果没有图片，创建一张空白卡片
      cards.push({
        front_text: '导入的卡片 - 请编辑正面内容',
        back_text: '导入的卡片 - 请编辑背面内容'
      });
    }

    return {
      name: '导入的牌组',
      description: '从.apkg文件导入（简化版）',
      cards
    };
  } catch (error) {
    console.error('导入.apkg文件失败:', error);
    throw new Error('导入失败: ' + (error as Error).message);
  }
}
