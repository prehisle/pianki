import { Deck } from '../../types';
import { getDb } from '../connection';
import { nextId } from '../meta';

export interface CreateDeckParams {
  name: string;
  description?: string;
}

export interface UpdateDeckParams {
  id: number;
  name: string;
  description?: string;
}

export interface DeckWithCount extends Deck {
  card_count: number;
}

const DECK_COLUMNS = `
  id,
  name,
  description,
  created_at,
  updated_at
`;

export function listDecksWithCounts(): DeckWithCount[] {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT ${DECK_COLUMNS}, IFNULL(card_counts.card_count, 0) AS card_count
        FROM decks
        LEFT JOIN (
          SELECT deck_id, COUNT(*) AS card_count
          FROM cards
          GROUP BY deck_id
        ) AS card_counts ON card_counts.deck_id = decks.id
        ORDER BY datetime(decks.created_at) DESC
      `
    )
    .all() as DeckWithCount[];
}

export function getDeckById(id: number): Deck | undefined {
  const db = getDb();
  return db.prepare(`SELECT ${DECK_COLUMNS} FROM decks WHERE id = ?`).get(id) as Deck | undefined;
}

export function getDeckWithCount(id: number): DeckWithCount | undefined {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT ${DECK_COLUMNS}, (
          SELECT COUNT(*) FROM cards WHERE deck_id = decks.id
        ) AS card_count
        FROM decks
        WHERE decks.id = ?
      `
    )
    .get(id) as DeckWithCount | undefined;
}

export function createDeck(params: CreateDeckParams): Deck {
  const db = getDb();
  const id = nextId('nextDeckId');
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO decks (id, name, description, created_at, updated_at)
      VALUES (@id, @name, @description, @created_at, @updated_at)
    `
  ).run({
    id,
    name: params.name,
    description: params.description ?? null,
    created_at: now,
    updated_at: now
  });
  return {
    id,
    name: params.name,
    description: params.description,
    created_at: now,
    updated_at: now
  };
}

export function updateDeck(params: UpdateDeckParams): Deck | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        UPDATE decks
        SET name = @name,
            description = @description,
            updated_at = @updated_at
        WHERE id = @id
      `
    )
    .run({
      id: params.id,
      name: params.name,
      description: params.description ?? null,
      updated_at: now
    });

  if (result.changes === 0) {
    return undefined;
  }

  return getDeckById(params.id) ?? undefined;
}

export function deleteDeck(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM decks WHERE id = ?').run(id);
  return result.changes > 0;
}
