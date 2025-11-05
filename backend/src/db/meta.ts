import { getDb } from './connection';

export function getMetaValue(key: string, defaultValue?: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) {
    return defaultValue;
  }
  return row.value;
}

export function setMetaValue(key: string, value: string) {
  const db = getDb();
  const result = db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(value, key);
  if (result.changes === 0) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(key, value);
  }
}

export function nextId(metaKey: 'nextDeckId' | 'nextCardId'): number {
  const current = Number(getMetaValue(metaKey));
  const next = Number.isFinite(current) && current > 0 ? current : 1;
  setMetaValue(metaKey, String(next + 1));
  return next;
}
