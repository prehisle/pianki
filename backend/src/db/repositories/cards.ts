import { Card, CreateCardInput, UpdateCardInput } from '../../types';
import { getDb } from '../connection';
import { nextId } from '../meta';

export interface ListCardsParams {
  deckId?: number;
}

const CARD_COLUMNS = `
  id,
  deck_id,
  front_text,
  front_image,
  back_text,
  back_image,
  created_at,
  updated_at
`;

export function listCards(params: ListCardsParams = {}): Card[] {
  const db = getDb();
  if (params.deckId) {
    return db
      .prepare(`SELECT ${CARD_COLUMNS} FROM cards WHERE deck_id = ? ORDER BY datetime(created_at) DESC`)
      .all(params.deckId) as Card[];
  }
  return db.prepare(`SELECT ${CARD_COLUMNS} FROM cards ORDER BY datetime(created_at) DESC`).all() as Card[];
}

export function getCardById(id: number): Card | undefined {
  const db = getDb();
  return db.prepare(`SELECT ${CARD_COLUMNS} FROM cards WHERE id = ?`).get(id) as Card | undefined;
}

export function createCard(input: CreateCardInput): Card {
  const db = getDb();
  const id = nextId('nextCardId');
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO cards (
        id,
        deck_id,
        front_text,
        front_image,
        back_text,
        back_image,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @deck_id,
        @front_text,
        @front_image,
        @back_text,
        @back_image,
        @created_at,
        @updated_at
      )
    `
  ).run({
    id,
    deck_id: input.deck_id,
    front_text: input.front_text ?? null,
    front_image: input.front_image ?? null,
    back_text: input.back_text ?? null,
    back_image: input.back_image ?? null,
    created_at: now,
    updated_at: now
  });

  return {
    id,
    deck_id: input.deck_id,
    front_text: input.front_text,
    front_image: input.front_image,
    back_text: input.back_text,
    back_image: input.back_image,
    created_at: now,
    updated_at: now
  };
}

export function updateCard(id: number, input: UpdateCardInput): Card | undefined {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
        UPDATE cards
        SET
          front_text = @front_text,
          front_image = @front_image,
          back_text = @back_text,
          back_image = @back_image,
          updated_at = @updated_at
        WHERE id = @id
      `
    )
    .run({
      id,
      front_text: input.front_text ?? null,
      front_image: input.front_image ?? null,
      back_text: input.back_text ?? null,
      back_image: input.back_image ?? null,
      updated_at: now
    });

  if (result.changes === 0) {
    return undefined;
  }

  return getCardById(id) ?? undefined;
}

export function deleteCard(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  return result.changes > 0;
}

export interface BulkCardInput {
  front_image?: string;
  back_image?: string;
  front_text?: string;
  back_text?: string;
}

export function bulkInsertCards(deckId: number, cards: BulkCardInput[]): number {
  if (cards.length === 0) {
    return 0;
  }

  const db = getDb();
  const insert = db.prepare(
    `
      INSERT INTO cards (
        id,
        deck_id,
        front_text,
        front_image,
        back_text,
        back_image,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @deck_id,
        @front_text,
        @front_image,
        @back_text,
        @back_image,
        @created_at,
        @updated_at
      )
    `
  );

  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const card of cards) {
      const id = nextId('nextCardId');
      insert.run({
        id,
        deck_id: deckId,
        front_text: card.front_text ?? null,
        front_image: card.front_image ?? null,
        back_text: card.back_text ?? null,
        back_image: card.back_image ?? null,
        created_at: now,
        updated_at: now
      });
    }
  });

  run();
  return cards.length;
}
