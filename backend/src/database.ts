import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { Deck, Card } from './types'

interface Database {
  decks: Deck[]
  cards: Card[]
  nextDeckId: number
  nextCardId: number
}

// 获取数据目录：优先使用环境变量，否则使用默认路径
const baseDataDir = process.env.PIANKI_DATA_DIR || path.join(__dirname, '..')
const dataDir = path.join(baseDataDir, 'data')
const uploadsDir = path.join(baseDataDir, 'uploads')

const DB_PATH = path.join(dataDir, 'db.json')

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// 导出路径以供其他模块使用
export { uploadsDir }

// 默认数据
function createDefaultData(): Database {
  const now = new Date().toISOString()
  return {
    decks: [
      {
        id: 1,
        name: '默认牌组',
        description: '我的第一个牌组',
        created_at: now,
        updated_at: now
      }
    ],
    cards: [],
    nextDeckId: 2,
    nextCardId: 1
  }
}

const defaultData: Database = createDefaultData()

class JsonDatabase<T extends object> {
  data: T

  constructor(private readonly filePath: string, private readonly defaults: T) {
    // Keep an in-memory copy so callers can access data before first read if desired
    this.data = this.cloneDefaults()
  }

  async read(): Promise<void> {
    try {
      const contents = await fsPromises.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(contents) as T | undefined
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Database file does not contain an object')
      }
      this.data = parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn('数据库文件不存在，创建默认数据')
      } else if (error instanceof SyntaxError) {
        console.warn('数据库文件损坏，重置为默认数据')
      } else if (error instanceof Error && error.message === 'Database file does not contain an object') {
        console.warn('数据库文件格式无效，重置为默认数据')
      } else {
        throw error
      }
      this.data = this.cloneDefaults()
      await this.write()
    }
  }

  async write(): Promise<void> {
    const serialized = JSON.stringify(this.data, null, 2)
    await fsPromises.writeFile(this.filePath, serialized, 'utf-8')
  }

  resetToDefaults(): T {
    this.data = this.cloneDefaults()
    return this.data
  }

  private cloneDefaults(): T {
    return JSON.parse(JSON.stringify(this.defaults)) as T
  }
}

export const db = new JsonDatabase<Database>(DB_PATH, defaultData)

export async function initDatabase() {
  try {
    await db.read()

    // 确保数据库结构完整
    if (!db.data || typeof db.data !== 'object') {
      console.log('数据库为空或损坏，使用默认数据')
      db.resetToDefaults()
      await db.write()
    } else {
      // 确保关键字段存在且为数组
      if (!Array.isArray(db.data.decks)) {
        console.log('修复 decks 字段')
        db.data.decks = createDefaultData().decks
      }
      if (!Array.isArray(db.data.cards)) {
        console.log('修复 cards 字段')
        db.data.cards = []
      }
      if (typeof db.data.nextDeckId !== 'number') {
        db.data.nextDeckId = (db.data.decks.length > 0
          ? Math.max(...db.data.decks.map(d => d.id)) + 1
          : 1)
      }
      if (typeof db.data.nextCardId !== 'number') {
        db.data.nextCardId = (db.data.cards.length > 0
          ? Math.max(...db.data.cards.map(c => c.id)) + 1
          : 1)
      }
      await db.write()
    }

    console.log('✅ 数据库初始化完成')
    console.log(`   - 牌组数量: ${db.data.decks.length}`)
    console.log(`   - 卡片数量: ${db.data.cards.length}`)
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    throw error
  }
}

export default db
