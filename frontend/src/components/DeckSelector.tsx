import { Deck } from '../api'
import './DeckSelector.css'

interface DeckSelectorProps {
  decks: Deck[]
  currentDeckId: number | null
  onSelectDeck: (id: number) => void
  onCreateDeck: () => void
  onRenameDeck: (id: number) => void
  onDeleteDeck: (id: number) => void
  onExport: () => void
}

export default function DeckSelector({
  decks,
  currentDeckId,
  onSelectDeck,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onExport
}: DeckSelectorProps) {
  return (
    <div className="deck-selector">
      <div className="deck-header">
        <h2>牌组</h2>
        <button className="btn btn-sm" onClick={onCreateDeck}>
          ➕
        </button>
      </div>

      <div className="deck-list">
        {decks.map(deck => (
          <div
            key={deck.id}
            className={`deck-item ${currentDeckId === deck.id ? 'active' : ''}`}
          >
            <div className="deck-info" onClick={() => onSelectDeck(deck.id)}>
              <div className="deck-name">{deck.name}</div>
              <div className="deck-count">{deck.card_count || 0} 张</div>
            </div>
            <div className="deck-actions">
              <button
                className="deck-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onRenameDeck(deck.id)
                }}
                title="重命名"
              >
                ✏️
              </button>
              <button
                className="deck-action-btn deck-action-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteDeck(deck.id)
                }}
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {currentDeckId && (
        <button className="btn btn-success btn-export" onClick={onExport}>
          📦 导出为 .apkg
        </button>
      )}
    </div>
  )
}
