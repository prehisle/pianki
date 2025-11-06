import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadsDir } from '../database';
import { CreateCardInput, UpdateCardInput } from '../types';
import {
  listCards as listCardsRepo,
  getCardById,
  createCard as createCardRecord,
  updateCard as updateCardRecord,
  deleteCard as deleteCardRecord
} from '../db/repositories/cards';

const router = express.Router();

// 配置图片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件 (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// 获取所有卡片
router.get('/', (req, res) => {
  try {
    const { deck_id, order, dir } = req.query as any;
    const deckId = deck_id ? Number.parseInt(deck_id as string, 10) : undefined;
    const ord = order === 'created' || order === 'updated' ? order : 'custom';
    const direction = dir === 'asc' ? 'asc' : 'desc';
    const cards = listCardsRepo({ deckId, order: ord, dir: direction });
    res.json(cards);
  } catch (error) {
    console.error('获取卡片失败:', error);
    res.status(500).json({ error: '获取卡片失败' });
  }
});

// 获取单个卡片
router.get('/:id', (req, res) => {
  try {
    const cardId = Number.parseInt(req.params.id, 10);
    const card = getCardById(cardId);
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: '获取卡片失败' });
  }
});

// 创建卡片
router.post('/', (req, res) => {
  try {
    const { deck_id, front_text, front_image, back_text, back_image, insert_before_id, insert_after_id }: CreateCardInput = req.body;

    if (!deck_id) {
      return res.status(400).json({ error: '缺少 deck_id' });
    }

    const newCard = createCardRecord({
      deck_id,
      front_text,
      front_image,
      back_text,
      back_image,
      insert_before_id,
      insert_after_id
    });

    res.status(201).json(newCard);
  } catch (error) {
    res.status(500).json({ error: '创建卡片失败' });
  }
});

// 更新卡片
router.put('/:id', (req, res) => {
  try {
    const cardId = Number.parseInt(req.params.id, 10);
    const payload: UpdateCardInput = req.body;
    const updated = updateCardRecord(cardId, payload);
    if (!updated) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: '更新卡片失败' });
  }
});

// 删除卡片
router.delete('/:id', (req, res) => {
  try {
    const cardId = Number.parseInt(req.params.id, 10);
    const removed = deleteCardRecord(cardId);
    if (!removed) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    res.json({ message: '卡片已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除卡片失败' });
  }
});

// 上传图片
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ error: '上传图片失败' });
  }
});

export default router;
