import path from 'path';
import fs from 'fs';

const baseDataDir = process.env.PIANKI_DATA_DIR || path.join(__dirname, '..', '..');
export const dataDir = path.join(baseDataDir, 'data');
export const uploadsDir = path.join(baseDataDir, 'uploads');
export const sqlitePath = path.join(dataDir, 'pianki.db');

export function ensureDirectories() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}
