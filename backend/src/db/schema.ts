export const SCHEMA_VERSION = 1;

export const INITIAL_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  deck_id INTEGER NOT NULL,
  front_text TEXT,
  front_image TEXT,
  back_text TEXT,
  back_image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards (deck_id);
`;

export const DEFAULT_META_ENTRIES: Record<string, string> = {
  schema_version: String(SCHEMA_VERSION),
  nextDeckId: '2',
  nextCardId: '1'
};
