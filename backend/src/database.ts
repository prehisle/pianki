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
  await db.read()

  // 如果数据库为空，使用默认数据
  if (!db.data) {
    db.data = defaultData
    await db.write()
  }

  console.log('✅ 数据库初始化完成')
}

export default db
