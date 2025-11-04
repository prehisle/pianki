import AnkiExport from 'anki-apkg-export';
import { marked } from 'marked';
import path from 'path';
import fs from 'fs';
import { Deck, Card } from './types';

// 从Markdown文本中提取图片URL
function extractImageUrls(markdown: string): string[] {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

// 处理内容：转换Markdown为HTML，并处理图片
function processContent(markdown: string, apkg: any): string {
  if (!markdown) return '';

  // 提取图片URL
  const imageUrls = extractImageUrls(markdown);

  // 处理每个图片
  let processedMarkdown = markdown;
  for (const imageUrl of imageUrls) {
    // 检查是否是本地上传的图片（相对路径）
    if (imageUrl.startsWith('/uploads/')) {
      const fullPath = path.join(__dirname, '../', imageUrl);

      if (fs.existsSync(fullPath)) {
        const imageData = fs.readFileSync(fullPath);
        const imageName = path.basename(imageUrl);

        // 添加图片到Anki包
        apkg.addMedia(imageName, imageData);

        // 替换相对路径为本地文件名
        processedMarkdown = processedMarkdown.replace(imageUrl, imageName);
      }
    }
  }

  // 转换Markdown为HTML
  const html = marked.parse(processedMarkdown, { async: false }) as string;

  return html;
}

export async function exportToAnki(deck: Deck, cards: Card[]): Promise<Buffer> {
  const apkg = new AnkiExport(deck.name);

  for (const card of cards) {
    // 处理正面和背面内容
    const frontContent = processContent(card.front_text || '', apkg);
    const backContent = processContent(card.back_text || '', apkg);

    // 添加卡片到Anki导出
    if (frontContent || backContent) {
      apkg.addCard(frontContent || '(空)', backContent || '(空)');
    }
  }

  // 生成并返回.apkg文件
  const zip = await apkg.save();
  return Buffer.from(zip);
}
