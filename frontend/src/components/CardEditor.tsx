import { useState } from 'react'
import { Card } from '../api'
import MarkdownEditor from './MarkdownEditor'
import './CardEditor.css'

interface CardEditorProps {
  card: Card | null
  onSave: (cardData: Partial<Card>) => void
  onCancel: () => void
}

export default function CardEditor({ card, onSave, onCancel }: CardEditorProps) {
  const [frontText, setFrontText] = useState(card?.front_text || '')
  const [backText, setBackText] = useState(card?.back_text || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      front_text: frontText || undefined,
      back_text: backText || undefined
    })
  }

  return (
    <div className="card-editor">
      <div className="editor-header">
        <h2>{card ? '编辑卡片' : '新建卡片'}</h2>
        <div className="editor-tip">
          💡 在编辑器中可以直接粘贴图片或点击"插入图片"按钮
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="editor-grid">
          <div className="editor-section">
            <h3>正面</h3>
            <MarkdownEditor
              value={frontText}
              onChange={setFrontText}
              placeholder="输入卡片正面内容... 支持Markdown格式和图片"
            />
          </div>

          <div className="editor-section">
            <h3>背面</h3>
            <MarkdownEditor
              value={backText}
              onChange={setBackText}
              placeholder="输入卡片背面内容... 支持Markdown格式和图片"
            />
          </div>
        </div>

        <div className="editor-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
