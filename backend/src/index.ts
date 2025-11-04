import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase, uploadsDir } from './database';
import cardsRouter from './routes/cards';
import decksRouter from './routes/decks';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供上传的图片
app.use('/uploads', express.static(uploadsDir));

// 初始化数据库
initDatabase().then(() => {
  // 路由
  app.use('/api/cards', cardsRouter);
  app.use('/api/decks', decksRouter);

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Pianki API is running' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📡 API地址: http://localhost:${PORT}/api`);
  });
});
