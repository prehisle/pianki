import { Card } from '../api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './CardList.css'

interface CardListProps {
  cards: Card[]
  onEdit: (card: Card) => void
  onDelete: (id: number) => void
}

// 自定义图片渲染器，将相对路径转换为完整URL
const imageRenderer = ({ src, alt }: { src?: string; alt?: string }) => {
  if (!src) return null

  // 如果是相对路径（以/uploads/开头），添加服务器地址
  const imageSrc = src.startsWith('/uploads/')
    ? `http://localhost:3001${src}`
    : src

  return <img src={imageSrc} alt={alt || '图片'} />
}

export default function CardList({ cards, onEdit, onDelete }: CardListProps) {
  if (cards.length === 0) {
    return (
      <div className="empty-cards">
        <p>还没有卡片，点击"新建卡片"开始创建吧！</p>
      </div>
    )
  }

  return (
    <div className="card-list">
      {cards.map(card => (
        <div key={card.id} className="card-item">
          <div className="card-content">
            <div className="card-side">
              <div className="card-label">正面</div>
              {card.front_text ? (
                <div className="card-text card-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ img: imageRenderer }}
                  >
                    {card.front_text}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="card-empty">(空)</div>
              )}
            </div>

            <div className="card-divider">→</div>

            <div className="card-side">
              <div className="card-label">背面</div>
              {card.back_text ? (
                <div className="card-text card-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ img: imageRenderer }}
                  >
                    {card.back_text}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="card-empty">(空)</div>
              )}
            </div>
          </div>

          <div className="card-actions">
            <button className="btn btn-sm btn-secondary" onClick={() => onEdit(card)}>
              ✏️ 编辑
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(card.id)}>
              🗑️ 删除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
