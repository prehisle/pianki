import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadsDir } from '../database';
import { CreateDeckInput } from '../types';
import {
  listDecksWithCounts,
  getDeckWithCount,
  createDeck as createDeckRecord,
  updateDeck as updateDeckRecord,
  deleteDeck as deleteDeckRecord
} from '../db/repositories/decks';
import { listCards, bulkInsertCards } from '../db/repositories/cards';

const router = express.Router();

// 配置.apkg文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.apkg') {
      cb(null, true);
    } else {
      cb(new Error('只支持.apkg文件'));
    }
  }
});

// 获取所有牌组
router.get('/', (_req, res) => {
  try {
    const decks = listDecksWithCounts();
    res.json(decks);
  } catch (error) {
    console.error('获取牌组失败:', error);
    res.status(500).json({ error: '获取牌组失败' });
  }
});

// 获取单个牌组
router.get('/:id', (req, res) => {
  try {
    const deckId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(deckId)) {
      return res.status(400).json({ error: '无效的牌组ID' });
    }
    const deck = getDeckWithCount(deckId);
    if (!deck) {
      return res.status(404).json({ error: '牌组不存在' });
    }
    res.json(deck);
  } catch (error) {
    res.status(500).json({ error: '获取牌组失败' });
  }
});

// 创建牌组
router.post('/', (req, res) => {
  try {
    const { name, description }: CreateDeckInput = req.body;

    if (!name) {
      return res.status(400).json({ error: '牌组名称不能为空' });
    }

    const newDeck = createDeckRecord({ name, description });
    res.status(201).json(newDeck);
  } catch (error) {
    res.status(500).json({ error: '创建牌组失败' });
  }
});

// 更新牌组
router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    const deckId = Number.parseInt(req.params.id, 10);

    if (!name) {
      return res.status(400).json({ error: '牌组名称不能为空' });
    }

    const updated = updateDeckRecord({ id: deckId, name, description });
    if (!updated) {
      return res.status(404).json({ error: '牌组不存在' });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: '更新牌组失败' });
  }
});

// 删除牌组
router.delete('/:id', (req, res) => {
  try {
    const deckId = Number.parseInt(req.params.id, 10);
    const removed = deleteDeckRecord(deckId);
    if (!removed) {
      return res.status(404).json({ error: '牌组不存在' });
    }
    res.json({ message: '牌组已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除牌组失败' });
  }
});

// 导出牌组为Anki格式
router.get('/:id/export', async (req, res) => {
  try {
    const deckId = Number.parseInt(req.params.id, 10);
    const deckWithCount = getDeckWithCount(deckId);

    if (!deckWithCount) {
      return res.status(404).json({ error: '牌组不存在' });
    }

    const cards = listCards({ deckId });

    if (cards.length === 0) {
      return res.status(400).json({ error: '牌组中没有卡片' });
    }

    const { card_count: _cardCount, ...deck } = deckWithCount;
    // 动态导入，避免后端冷启动加载重型依赖
    const { exportToAnki } = await import('../anki-export');
    const apkgBuffer = await exportToAnki(deck, cards);

    res.setHeader('Content-Type', 'application/apkg');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(deck.name)}.apkg"`);
    res.send(apkgBuffer);
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ error: '导出牌组失败' });
  }
});

// 导入.apkg文件
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 动态导入，避免后端冷启动加载重型依赖
    const { importFromAnki } = await import('../anki-import');
    const importedDeck = await importFromAnki(req.file.buffer, uploadsDir);

    const newDeck = createDeckRecord({
      name: importedDeck.name,
      description: '从.apkg文件导入'
    });

    const cardsImported = importedDeck.cards.length;
    if (cardsImported > 0) {
      bulkInsertCards(
        newDeck.id,
        importedDeck.cards.map(card => ({
          front_text: card.front_text,
          front_image: card.front_image,
          back_text: card.back_text,
          back_image: card.back_image
        }))
      );
    }

    res.status(201).json({
      deck: { ...newDeck, card_count: cardsImported },
      cardsImported
    });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ error: '导入失败: ' + (error as Error).message });
  }
});

export default router;
