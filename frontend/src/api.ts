import axios from 'axios'

// 在 Tauri 环境中使用绝对 URL，开发环境使用相对路径（通过 Vite proxy）
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window as any).__TAURI_IPC__
    ? 'http://localhost:3001/api'
    : '/api')

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
}

// 牌组相关API
export async function fetchDecks(): Promise<Deck[]> {
  const response = await axios.get(`${API_BASE_URL}/decks`)
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
export async function fetchCards(deckId?: number): Promise<Card[]> {
  const url = deckId ? `${API_BASE_URL}/cards?deck_id=${deckId}` : `${API_BASE_URL}/cards`
  const response = await axios.get(url)
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
