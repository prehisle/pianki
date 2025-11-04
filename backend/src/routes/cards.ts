import express from 'express';
import multer from 'multer';
import path from 'path';
import db, { uploadsDir } from '../database';
import { CreateCardInput, UpdateCardInput } from '../types';

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
router.get('/', async (req, res) => {
  try {
    await db.read();
    const { deck_id } = req.query;

    // 防御性检查：确保 cards 是数组
    let cards = Array.isArray(db.data?.cards) ? db.data.cards : [];

    if (deck_id) {
      cards = cards.filter(c => c.deck_id === parseInt(deck_id as string));
    }

    // 按创建时间倒序排列
    cards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(cards);
  } catch (error) {
    console.error('获取卡片失败:', error);
    res.status(500).json({ error: '获取卡片失败' });
  }
});

// 获取单个卡片
router.get('/:id', async (req, res) => {
  try {
    await db.read();
    const card = db.data.cards.find(c => c.id === parseInt(req.params.id));
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: '获取卡片失败' });
  }
});

// 创建卡片
router.post('/', async (req, res) => {
  try {
    const { deck_id, front_text, front_image, back_text, back_image }: CreateCardInput = req.body;

    if (!deck_id) {
      return res.status(400).json({ error: '缺少deck_id' });
    }

    await db.read();

    const newCard = {
      id: db.data.nextCardId++,
      deck_id,
      front_text: front_text || undefined,
      front_image: front_image || undefined,
      back_text: back_text || undefined,
      back_image: back_image || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.data.cards.push(newCard);
    await db.write();

    res.status(201).json(newCard);
  } catch (error) {
    res.status(500).json({ error: '创建卡片失败' });
  }
});

// 更新卡片
router.put('/:id', async (req, res) => {
  try {
    const { front_text, front_image, back_text, back_image }: UpdateCardInput = req.body;
    const cardId = parseInt(req.params.id);

    await db.read();

    const cardIndex = db.data.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ error: '卡片不存在' });
    }

    db.data.cards[cardIndex] = {
      ...db.data.cards[cardIndex],
      front_text: front_text || undefined,
      front_image: front_image || undefined,
      back_text: back_text || undefined,
      back_image: back_image || undefined,
      updated_at: new Date().toISOString()
    };

    await db.write();

    res.json(db.data.cards[cardIndex]);
  } catch (error) {
    res.status(500).json({ error: '更新卡片失败' });
  }
});

// 删除卡片
router.delete('/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);

    await db.read();

    const cardIndex = db.data.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ error: '卡片不存在' });
    }

    db.data.cards.splice(cardIndex, 1);
    await db.write();

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
