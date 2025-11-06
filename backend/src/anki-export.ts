import AnkiExport from 'anki-apkg-export';
import { marked } from 'marked';
import path from 'path';
import fs from 'fs';
import { Deck, Card } from './types';
import { uploadsDir } from './database';

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

// Anki卡片样式
const ANKI_CARD_STYLE = `
<style>
/* Override Anki's default center alignment */
.card {
  text-align: left;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #333;
  padding: 12px;
  margin: 0;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
}

h1 {
  font-size: 1.5em;
  border-bottom: 2px solid #eaecef;
  padding-bottom: 0.3em;
}

h2 {
  font-size: 1.3em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

h3 { font-size: 1.15em; }
h4 { font-size: 1em; }

p {
  margin-top: 0;
  margin-bottom: 0.8em;
}

ul, ol {
  margin-top: 0;
  margin-bottom: 0.8em;
  padding-left: 1.5em;
}

li {
  margin-bottom: 0.3em;
}

code {
  padding: 0.2em 0.4em;
  font-size: 0.9em;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

pre {
  padding: 1em;
  overflow: auto;
  font-size: 0.9em;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-bottom: 0.8em;
}

pre code {
  padding: 0;
  background-color: transparent;
  border-radius: 0;
}

blockquote {
  margin: 0 0 0.8em 0;
  padding: 0 1em;
  color: #6a737d;
  border-left: 4px solid #dfe2e5;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0.8em;
}

table th, table td {
  padding: 0.5em 0.8em;
  border: 1px solid #dfe2e5;
}

table th {
  background-color: #f6f8fa;
  font-weight: 600;
}

a {
  color: #0366d6;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

img {
  max-width: 100%;
  height: auto;
  margin: 0.5em 0;
  border-radius: 4px;
}

hr {
  height: 0.25em;
  padding: 0;
  margin: 1.5em 0;
  background-color: #e1e4e8;
  border: 0;
}

strong { font-weight: 600; }
em { font-style: italic; }
</style>
`;

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
      const fileName = imageUrl.replace('/uploads/', '');
      const fullPath = path.join(uploadsDir, fileName);

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
  // 在 Anki 中也保留单个换行（与前端预览一致）
  const html = marked.parse(processedMarkdown, { async: false, breaks: true }) as string;

  // 添加样式
  return ANKI_CARD_STYLE + html;
}

export async function exportToAnki(deck: Deck, cards: Card[]): Promise<Buffer> {
  const apkg = new AnkiExport(deck.name);

  for (const card of cards) {
    // 处理正面和背面内容
    let frontContent = processContent(card.front_text || '', apkg);
    let backContent = processContent(card.back_text || '', apkg);

    // 处理正面图片
    if (card.front_image) {
      const fileName = card.front_image.replace('/uploads/', '');
      const fullPath = path.join(uploadsDir, fileName);
      if (fs.existsSync(fullPath)) {
        const imageData = fs.readFileSync(fullPath);
        const imageName = path.basename(card.front_image);
        apkg.addMedia(imageName, imageData);
        frontContent = `<img src="${imageName}" style="max-width: 100%; height: auto;" />` + frontContent;
      }
    }

    // 处理背面图片
    if (card.back_image) {
      const fileName = card.back_image.replace('/uploads/', '');
      const fullPath = path.join(uploadsDir, fileName);
      if (fs.existsSync(fullPath)) {
        const imageData = fs.readFileSync(fullPath);
        const imageName = path.basename(card.back_image);
        apkg.addMedia(imageName, imageData);
        backContent = `<img src="${imageName}" style="max-width: 100%; height: auto;" />` + backContent;
      }
    }

    // 添加卡片到Anki导出
    if (frontContent || backContent) {
      apkg.addCard(frontContent || '(空)', backContent || '(空)');
    }
  }

  // 生成并返回.apkg文件
  const zip = await apkg.save();
  return Buffer.from(zip);
}
