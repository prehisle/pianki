import axios from 'axios'

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '')

let API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL)
    : import.meta.env.DEV
      ? '/api'
      : 'http://127.0.0.1:9908/api'
)

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function setBackendPort(port: number) {
  if (!import.meta.env.DEV) {
    API_BASE_URL = trimTrailingSlash(`http://127.0.0.1:${port}/api`)
  }
}

export interface Deck {
  id: number
  name: string
  description?: string
  card_count?: number
  created_at: string
  updated_at: string
}

export interface Card {
  id: number
  deck_id: number
  guid: string
  front_text?: string
  front_image?: string
  back_text?: string
  back_image?: string
  created_at: string
  updated_at: string
}

export interface CreateCardInput {
  deck_id: number
  front_text?: string
  front_image?: string
  back_text?: string
  back_image?: string
  // 自定义顺序插入（可选）
  insert_before_id?: number
  insert_after_id?: number
}

// 牌组相关API
export async function fetchDecks(): Promise<Deck[]> {
  const response = await axios.get(`${API_BASE_URL}/decks`)
  if (!Array.isArray(response.data)) {
    console.error('获取牌组接口返回异常数据:', response.data)
    throw new Error('获取牌组数据格式不正确')
  }
  return response.data
}

export async function createDeck(data: { name: string; description?: string }): Promise<Deck> {
  const response = await axios.post(`${API_BASE_URL}/decks`, data)
  return response.data
}

export async function updateDeck(id: number, data: { name: string; description?: string }): Promise<Deck> {
  const response = await axios.put(`${API_BASE_URL}/decks/${id}`, data)
  return response.data
}

export async function deleteDeck(id: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/decks/${id}`)
}

export async function exportDeck(deckId: number): Promise<Blob> {
  const response = await axios.get(`${API_BASE_URL}/decks/${deckId}/export`, {
    responseType: 'blob'
  })
  return response.data
}

export async function importDeck(file: File): Promise<{ deck: Deck; cardsImported: number }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await axios.post(`${API_BASE_URL}/decks/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data
}

// 卡片相关API
export async function fetchCards(
  deckId?: number,
  order: 'custom' | 'created' | 'updated' = 'custom',
  dir: 'asc' | 'desc' = 'desc'
): Promise<Card[]> {
  const params = new URLSearchParams()
  if (deckId) params.set('deck_id', String(deckId))
  if (order) params.set('order', order)
  if (dir) params.set('dir', dir)
  const url = `${API_BASE_URL}/cards${params.toString() ? `?${params.toString()}` : ''}`
  const response = await axios.get(url)
  if (!Array.isArray(response.data)) {
    console.error('获取卡片接口返回异常数据:', response.data)
    throw new Error('获取卡片数据格式不正确')
  }
  return response.data
}

export async function createCard(data: CreateCardInput): Promise<Card> {
  const response = await axios.post(`${API_BASE_URL}/cards`, data)
  return response.data
}

export async function updateCard(id: number, data: Partial<Card>): Promise<Card> {
  const response = await axios.put(`${API_BASE_URL}/cards/${id}`, data)
  return response.data
}

export async function deleteCard(id: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/cards/${id}`)
}

// 图片上传
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const response = await axios.post(`${API_BASE_URL}/cards/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data.url
}
