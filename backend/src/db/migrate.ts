import path from 'path';
import fs from 'fs/promises';
import { ensureDirectories, dataDir, sqlitePath } from './paths';
import { ensureSchema, getDb, closeDb } from './connection';
import { setMetaValue } from './meta';
import type { Deck, Card } from '../types';

interface JsonDatabaseShape {
  decks: Deck[];
  cards: Card[];
  nextDeckId: number;
  nextCardId: number;
}

export async function migrateJsonToSqlite(): Promise<boolean> {
  ensureDirectories();
  const jsonPath = path.join(dataDir, 'db.json');
  let raw: string;
  try {
    raw = await fs.readFile(jsonPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  const parsed = JSON.parse(raw) as Partial<JsonDatabaseShape>;
  const decks = Array.isArray(parsed.decks) ? parsed.decks : [];
  const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
  const nextDeckId = typeof parsed.nextDeckId === 'number' ? parsed.nextDeckId : decks.length + 1;
  const nextCardId = typeof parsed.nextCardId === 'number' ? parsed.nextCardId : cards.length + 1;

  await ensureSchema();
  const db = getDb();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM cards').run();
    db.prepare('DELETE FROM decks').run();

    const insertDeck = db.prepare(`
      INSERT INTO decks (id, name, description, created_at, updated_at)
      VALUES (@id, @name, @description, @created_at, @updated_at)
    `);
    for (const deck of decks) {
      insertDeck.run({
        id: deck.id,
        name: deck.name,
        description: deck.description ?? null,
        created_at: deck.created_at,
        updated_at: deck.updated_at
      });
    }

    const insertCard = db.prepare(`
      INSERT INTO cards (
        id,
        deck_id,
        front_text,
        front_image,
        back_text,
        back_image,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @deck_id,
        @front_text,
        @front_image,
        @back_text,
        @back_image,
        @created_at,
        @updated_at
      )
    `);
    for (const card of cards) {
      insertCard.run({
        id: card.id,
        deck_id: card.deck_id,
        front_text: card.front_text ?? null,
        front_image: card.front_image ?? null,
        back_text: card.back_text ?? null,
        back_image: card.back_image ?? null,
        created_at: card.created_at,
        updated_at: card.updated_at
      });
    }

    const computedNextDeckId =
      decks.length > 0 ? Math.max(...decks.map(d => d.id)) + 1 : 2;
    const computedNextCardId =
      cards.length > 0 ? Math.max(...cards.map(c => c.id)) + 1 : 1;

    setMetaValue('nextDeckId', String(Math.max(nextDeckId, computedNextDeckId)));
    setMetaValue('nextCardId', String(Math.max(nextCardId, computedNextCardId)));
  });

  transaction();
  closeDb();

  const backupPath = `${jsonPath}.bak-${Date.now()}`;
  await fs.rename(jsonPath, backupPath);
  return true;
}

export async function needsMigration(): Promise<boolean> {
  const jsonPath = path.join(dataDir, 'db.json');
  try {
    await fs.access(jsonPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
