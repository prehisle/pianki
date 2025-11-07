import { randomBytes, createHash } from 'crypto';
import { Card, CreateCardInput, UpdateCardInput } from '../../types';
import { getDb } from '../connection';
import { nextId } from '../meta';

export interface ListCardsParams {
  deckId?: number;
  order?: 'custom' | 'created' | 'updated';
  dir?: 'asc' | 'desc';
}

const CARD_COLUMNS = `
  id,
  deck_id,
  guid,
  front_text,
  front_image,
  back_text,
  back_image,
  created_at,
  updated_at
`;

export function listCards(params: ListCardsParams = {}): Card[] {
  const db = getDb();
  const order = params.order || 'custom';
  const dir = (params.dir || 'desc').toUpperCase();
  const where = params.deckId ? 'WHERE deck_id = ?' : '';
  // 注意：created_at/updated_at 为 ISO8601 字符串，直接比较可按时间排序且可命中索引
  const orderBy =
    order === 'custom'
      ? 'ORDER BY sort_key ASC, created_at ASC'
      : order === 'updated'
      ? `ORDER BY updated_at ${dir}`
      : `ORDER BY created_at ${dir}`;

  if (params.deckId) {
    return db
      .prepare(`SELECT ${CARD_COLUMNS} FROM cards ${where} ${orderBy}`)
      .all(params.deckId) as Card[];
  }
  return db.prepare(`SELECT ${CARD_COLUMNS} FROM cards ${orderBy}`).all() as Card[];
}

export function getCardById(id: number): Card | undefined {
  const db = getDb();
  return db.prepare(`SELECT ${CARD_COLUMNS} FROM cards WHERE id = ?`).get(id) as Card | undefined;
}

export function createCard(input: CreateCardInput & { insert_before_id?: number; insert_after_id?: number }): Card {
  const db = getDb();
  const id = nextId('nextCardId');
  const now = new Date().toISOString();
  const guid = input.guid && input.guid.trim().length > 0 ? input.guid.trim() : generateUniqueGuid(db);
  // 计算 sort_key（自定义顺序）
  let sortKey = 0;
  if (input.insert_before_id || input.insert_after_id) {
    if (input.insert_before_id) {
      // before: between left neighbor and anchor
      const anchor = db.prepare('SELECT sort_key, deck_id FROM cards WHERE id = ?').get(input.insert_before_id) as any;
      if (anchor && anchor.deck_id === input.deck_id) {
        const left = db
          .prepare('SELECT sort_key FROM cards WHERE deck_id = ? AND sort_key < ? ORDER BY sort_key DESC LIMIT 1')
          .get(input.deck_id, anchor.sort_key) as any;
        sortKey = left ? (left.sort_key + anchor.sort_key) / 2 : anchor.sort_key - 1000;
      }
    } else if (input.insert_after_id) {
      const anchor = db.prepare('SELECT sort_key, deck_id FROM cards WHERE id = ?').get(input.insert_after_id) as any;
      if (anchor && anchor.deck_id === input.deck_id) {
        const right = db
          .prepare('SELECT sort_key FROM cards WHERE deck_id = ? AND sort_key > ? ORDER BY sort_key ASC LIMIT 1')
          .get(input.deck_id, anchor.sort_key) as any;
        sortKey = right ? (right.sort_key + anchor.sort_key) / 2 : anchor.sort_key + 1000;
      }
    }
  } else {
    // 追加到末尾
    const last = db
      .prepare('SELECT sort_key FROM cards WHERE deck_id = ? ORDER BY sort_key DESC LIMIT 1')
      .get(input.deck_id) as any;
    sortKey = last ? last.sort_key + 1000 : 1000;
  }

  db.prepare(
    `
      INSERT INTO cards (
        id,
        deck_id,
        front_text,
        front_image,
        back_text,
        back_image,
        guid,
        sort_key,
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
        @guid,
        @sort_key,
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
    guid,
    sort_key: sortKey,
    created_at: now,
    updated_at: now
  });

  return {
    id,
    deck_id: input.deck_id,
    guid,
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
  guid?: string;
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
        guid,
        front_text,
        front_image,
        back_text,
        back_image,
        sort_key,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @deck_id,
        @guid,
        @front_text,
        @front_image,
        @back_text,
        @back_image,
        @sort_key,
        @created_at,
        @updated_at
      )
    `
  );

  const now = new Date().toISOString();
  const last = db
    .prepare('SELECT sort_key FROM cards WHERE deck_id = ? ORDER BY sort_key DESC LIMIT 1')
    .get(deckId) as { sort_key: number } | undefined;
  let sortKey = last ? last.sort_key + 1000 : 1000;
  const run = db.transaction(() => {
    for (const card of cards) {
      const id = nextId('nextCardId');
      const guid = card.guid && card.guid.trim().length > 0 ? card.guid.trim() : generateUniqueGuid(db);
      insert.run({
        id,
        deck_id: deckId,
        guid,
        front_text: card.front_text ?? null,
        front_image: card.front_image ?? null,
        back_text: card.back_text ?? null,
        back_image: card.back_image ?? null,
        sort_key: sortKey,
        created_at: now,
        updated_at: now
      });
      sortKey += 1000;
    }
  });

  run();
  return cards.length;
}

export function ensureCardGuid(cardId: number): string {
  const db = getDb();
  const row = db.prepare('SELECT guid FROM cards WHERE id = ?').get(cardId) as { guid?: string } | undefined;
  if (!row) {
    throw new Error(`Card ${cardId} not found while ensuring guid`);
  }

  const existing = row.guid?.trim();
  if (existing) {
    return existing;
  }

  const guid = generateUniqueGuid(db);
  db.prepare('UPDATE cards SET guid = ? WHERE id = ?').run(guid, cardId);
  return guid;
}

function generateUniqueGuid(db: ReturnType<typeof getDb>): string {
  const check = db.prepare('SELECT 1 FROM cards WHERE guid = ? LIMIT 1');
  let guid: string;
  do {
    guid = createHash('sha1').update(randomBytes(32)).digest('hex');
  } while (check.get(guid));
  return guid;
}
