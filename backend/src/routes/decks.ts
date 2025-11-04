import express from 'express';
import db from '../database';
import { CreateDeckInput } from '../types';
import { exportToAnki } from '../anki-export';

const router = express.Router();

// 获取所有牌组
router.get('/', async (req, res) => {
  try {
    await db.read();

    const decksWithCount = db.data.decks.map(deck => ({
      ...deck,
      card_count: db.data.cards.filter(c => c.deck_id === deck.id).length
    }));

    // 按创建时间倒序排列
    decksWithCount.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(decksWithCount);
  } catch (error) {
    res.status(500).json({ error: '获取牌组失败' });
  }
});

// 获取单个牌组
router.get('/:id', async (req, res) => {
  try {
    await db.read();

    const deckId = parseInt(req.params.id);
    const deck = db.data.decks.find(d => d.id === deckId);

    if (!deck) {
      return res.status(404).json({ error: '牌组不存在' });
    }

    const deckWithCount = {
      ...deck,
      card_count: db.data.cards.filter(c => c.deck_id === deckId).length
    };

    res.json(deckWithCount);
  } catch (error) {
    res.status(500).json({ error: '获取牌组失败' });
  }
});

// 创建牌组
router.post('/', async (req, res) => {
  try {
    const { name, description }: CreateDeckInput = req.body;

    if (!name) {
      return res.status(400).json({ error: '牌组名称不能为空' });
    }

    await db.read();

    const newDeck = {
      id: db.data.nextDeckId++,
      name,
      description: description || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.data.decks.push(newDeck);
    await db.write();

    res.status(201).json(newDeck);
  } catch (error) {
    res.status(500).json({ error: '创建牌组失败' });
  }
});

// 更新牌组
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const deckId = parseInt(req.params.id);

    await db.read();

    const deckIndex = db.data.decks.findIndex(d => d.id === deckId);
    if (deckIndex === -1) {
      return res.status(404).json({ error: '牌组不存在' });
    }

    db.data.decks[deckIndex] = {
      ...db.data.decks[deckIndex],
      name,
      description: description || undefined,
      updated_at: new Date().toISOString()
    };

    await db.write();

    res.json(db.data.decks[deckIndex]);
  } catch (error) {
    res.status(500).json({ error: '更新牌组失败' });
  }
});

// 删除牌组
router.delete('/:id', async (req, res) => {
  try {
    const deckId = parseInt(req.params.id);

    await db.read();

    const deckIndex = db.data.decks.findIndex(d => d.id === deckId);
    if (deckIndex === -1) {
      return res.status(404).json({ error: '牌组不存在' });
    }

    // 同时删除该牌组下的所有卡片
    db.data.decks.splice(deckIndex, 1);
    db.data.cards = db.data.cards.filter(c => c.deck_id !== deckId);

    await db.write();

    res.json({ message: '牌组已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除牌组失败' });
  }
});

// 导出牌组为Anki格式
router.get('/:id/export', async (req, res) => {
  try {
    const deckId = parseInt(req.params.id);

    await db.read();

    const deck = db.data.decks.find(d => d.id === deckId);

    if (!deck) {
      return res.status(404).json({ error: '牌组不存在' });
    }

    const cards = db.data.cards.filter(c => c.deck_id === deckId);

    if (cards.length === 0) {
      return res.status(400).json({ error: '牌组中没有卡片' });
    }

    const apkgBuffer = await exportToAnki(deck, cards);

    res.setHeader('Content-Type', 'application/apkg');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(deck.name)}.apkg"`);
    res.send(apkgBuffer);
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ error: '导出牌组失败' });
  }
});

export default router;
