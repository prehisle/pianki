import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDatabase, uploadsDir } from './database';
import { closeDb } from './db/connection';
import { baseDataDir, ensureDirectories as ensureDataDirectories } from './db/paths';
import cardsRouter from './routes/cards';
import decksRouter from './routes/decks';

const app = express();
const START_PORT = Number(process.env.PORT || 9908);
const END_PORT = Number(process.env.PORT_RANGE_END || (START_PORT + 20));

// 确保数据目录存在
ensureDataDirectories();

// 设置日志文件
const logFile = path.join(baseDataDir, 'pianki-backend.log');

// 日志函数
function formatLocalTimestamp(date: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetMins = pad(Math.abs(offsetMinutes) % 60);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}${offsetSign}${offsetHours}:${offsetMins}`;
}

function log(message: string) {
  const timestamp = formatLocalTimestamp(new Date());
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());

  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFileSync(logFile, logMessage);
        return;
      } catch (err) {
        console.error('无法创建日志目录:', err);
      }
    }
    console.error('无法写入日志文件:', error);
  }
}

log('=== Pianki 后端服务启动 ===');
log(`数据目录: ${baseDataDir}`);
log(`日志文件: ${logFile}`);
log(`起始端口: ${START_PORT}`);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供上传的图片
app.use('/uploads', express.static(uploadsDir));

// 初始化数据库
log('初始化数据库...');
initDatabase()
  .then(async () => {
    log('数据库初始化成功');

    // 路由
    app.use('/api/cards', cardsRouter);
    app.use('/api/decks', decksRouter);

    // 健康检查
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        message: 'Pianki API is running',
        dataDir: baseDataDir,
        uploadsDir: uploadsDir
      });
    });

    // 错误处理
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      log(`错误: ${err.message}`);
      log(`堆栈: ${err.stack}`);
      res.status(500).json({ error: '服务器内部错误', message: err.message });
    });

    // 绑定到可用端口（从 START_PORT 开始，遇到占用则递增，直到 END_PORT）
    const bindAvailablePort = (start: number, end: number): Promise<{ server: http.Server; port: number }> => {
      return new Promise((resolve, reject) => {
        let current = start;
        const tryListen = () => {
          const srv = app.listen(current);
          const onError = (err: any) => {
            if (err && err.code === 'EADDRINUSE' && current < end) {
              log(`端口 ${current} 被占用，尝试下一个...`);
              srv.off('error', onError);
              srv.off('listening', onListening);
              current += 1;
              tryListen();
            } else {
              reject(err);
            }
          };
          const onListening = () => {
            srv.off('error', onError);
            resolve({ server: srv, port: current });
          };
          srv.once('error', onError);
          srv.once('listening', onListening);
        };
        tryListen();
      });
    };

    const { server, port } = await bindAvailablePort(START_PORT, END_PORT);

    log(`🚀 服务器成功启动！`);
    log(`🌐 HTTP 地址: http://localhost:${port}`);
      log(`📡 API 地址: http://localhost:${port}/api`);
      log(`📁 上传目录: ${uploadsDir}`);
      log('===========================');
    

    // 优雅退出与父进程存活检测，避免安装器升级时文件被占用
    const shutdown = (reason: string) => {
      try { log(`收到退出信号：${reason}，正在关闭服务器...`); } catch {}
      try { server.close(); } catch {}
      try { closeDb(); } catch {}
      // 延时退出，给系统释放句柄时间
      setTimeout(() => process.exit(0), 200).unref();
    };

    // 信号处理（Windows/Linux/macOS）
    ['SIGINT','SIGTERM','SIGBREAK','SIGHUP'].forEach((sig) => {
      try {
        process.on(sig as NodeJS.Signals, () => shutdown(sig));
      } catch {}
    });

    process.on('uncaughtException', (err) => {
      log(`未捕获异常：${(err as Error).message}`);
      shutdown('uncaughtException');
    });

    process.on('beforeExit', () => shutdown('beforeExit'));
    process.on('exit', () => shutdown('exit'));

    // 父进程心跳：父进程消失则自杀（安装/升级时主进程被强制结束的兜底）
    const parentPid = process.ppid;
    const checkParentAlive = () => {
      try {
        process.kill(parentPid, 0); // 仅检测是否存在
        return true;
      } catch {
        return false;
      }
    };
    const interval = setInterval(() => {
      if (!checkParentAlive()) {
        log('检测到父进程不存在，准备退出以释放文件锁...');
        clearInterval(interval);
        shutdown('parent-gone');
      }
    }, 2000);
    interval.unref?.();
  })
  .catch((error) => {
    log(`❌ 数据库初始化失败: ${error.message}`);
    log(`堆栈: ${error.stack}`);
    process.exit(1);
  });
