import { useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TurndownService from 'turndown'
import { uploadImage } from '../api'
import './MarkdownEditor.css'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const turndownService = useRef(new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  }))

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + text + value.substring(end)

    onChange(newValue)

    // 设置光标位置到插入文本之后
    setTimeout(() => {
      textarea.focus()
      const newPos = start + text.length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const handleImageUpload = async (file: File) => {
    try {
      const url = await uploadImage(file)
      // 使用相对路径，不包含服务器地址
      const imageMarkdown = `![图片](${url})`
      insertAtCursor(imageMarkdown)
    } catch (error) {
      alert('图片上传失败')
      console.error(error)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    // 首先检查是否有图片
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          await handleImageUpload(file)
        }
        return
      }
    }

    // 检查是否有HTML内容（富文本）
    const htmlData = e.clipboardData?.getData('text/html')
    if (htmlData && htmlData.trim()) {
      e.preventDefault()
      try {
        // 将HTML转换为Markdown
        const markdown = turndownService.current.turndown(htmlData)
        insertAtCursor(markdown)
      } catch (error) {
        console.error('转换HTML失败:', error)
        // 如果转换失败，使用纯文本
        const plainText = e.clipboardData?.getData('text/plain')
        if (plainText) {
          insertAtCursor(plainText)
        }
      }
    }
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

  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar">
        <button
          type="button"
          className="toolbar-btn"
          title="插入图片"
          onClick={() => fileInputRef.current?.click()}
        >
          📷 插入图片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImageUpload(file)
            e.target.value = '' // 清空以允许重复上传同一文件
          }}
        />
        <div className="toolbar-divider"></div>
        <button
          type="button"
          className="toolbar-btn"
          title="粗体"
          onClick={() => insertAtCursor('**粗体文字**')}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="斜体"
          onClick={() => insertAtCursor('*斜体文字*')}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="代码"
          onClick={() => insertAtCursor('`代码`')}
        >
          {'<>'}
        </button>
        <div className="toolbar-divider"></div>
        <button
          type="button"
          className="toolbar-btn toolbar-help"
          title="Markdown语法帮助"
          onClick={() => {
            const help = `
Markdown语法快速参考：

**粗体**  或  __粗体__
*斜体*  或  _斜体_
~~删除线~~

# 标题1
## 标题2
### 标题3

- 无序列表项
- 无序列表项

1. 有序列表项
2. 有序列表项

[链接文字](https://example.com)
![图片说明](图片URL)

> 引用文本

\`代码\`

\`\`\`
代码块
\`\`\`
            `.trim()
            alert(help)
          }}
        >
          ❓
        </button>
      </div>

      <div className="markdown-content split-view">
        <div className="editor-pane">
          <div className="pane-label">编辑</div>
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder || '支持Markdown格式... 可直接粘贴图片'}
            rows={10}
          />
        </div>
        <div className="preview-pane">
          <div className="pane-label">预览</div>
          <div className="markdown-preview">
            {value ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: imageRenderer
                }}
              >
                {value}
              </ReactMarkdown>
            ) : (
              <div className="preview-empty">实时预览...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
