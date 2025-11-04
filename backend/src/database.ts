import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs'
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
const defaultData: Database = {
  decks: [
    {
      id: 1,
      name: '默认牌组',
      description: '我的第一个牌组',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  cards: [],
  nextDeckId: 2,
  nextCardId: 1
}

const adapter = new JSONFile<Database>(DB_PATH)
export const db = new Low<Database>(adapter, defaultData)

export async function initDatabase() {
  try {
    await db.read()

    // 确保数据库结构完整
    if (!db.data || typeof db.data !== 'object') {
      console.log('数据库为空或损坏，使用默认数据')
      db.data = defaultData
      await db.write()
    } else {
      // 确保关键字段存在且为数组
      if (!Array.isArray(db.data.decks)) {
        console.log('修复 decks 字段')
        db.data.decks = defaultData.decks
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
