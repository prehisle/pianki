export interface Deck {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: number;
  deck_id: number;
  guid: string;
  front_text?: string;
  front_image?: string;
  back_text?: string;
  back_image?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCardInput {
  deck_id: number;
  front_text?: string;
  front_image?: string;
  back_text?: string;
  back_image?: string;
  guid?: string;
  insert_before_id?: number;
  insert_after_id?: number;
}

export interface UpdateCardInput {
  front_text?: string;
  front_image?: string;
  back_text?: string;
  back_image?: string;
}

export interface CreateDeckInput {
  name: string;
  description?: string;
}
