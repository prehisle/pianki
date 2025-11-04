import { useRef } from 'react'
import { Textarea, Button, Group, Paper, Text, Stack, Grid, FileButton } from '@mantine/core'
import { IconPhoto, IconBold, IconItalic, IconCode, IconHelp } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TurndownService from 'turndown'
import { uploadImage } from '../api'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import '../styles/markdown.css'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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

  const handleImageUpload = async (file: File | null) => {
    if (!file) return

    try {
      const url = await uploadImage(file)
      // 使用相对路径，不包含服务器地址
      const imageMarkdown = `![图片](${url})`
      insertAtCursor(imageMarkdown)
      notifications.show({
        title: '成功',
        message: '图片上传成功',
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: '错误',
        message: '图片上传失败',
        color: 'red',
      })
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

    return <img src={imageSrc} alt={alt || '图片'} style={{ maxWidth: '100%' }} />
  }

  const showHelp = () => {
    modals.open({
      title: 'Markdown 语法帮助',
      children: (
        <Stack gap="xs">
          <Text size="sm">**粗体** 或 __粗体__</Text>
          <Text size="sm">*斜体* 或 _斜体_</Text>
          <Text size="sm">~~删除线~~</Text>
          <Text size="sm" mt="xs"># 标题1</Text>
          <Text size="sm">## 标题2</Text>
          <Text size="sm">### 标题3</Text>
          <Text size="sm" mt="xs">- 无序列表项</Text>
          <Text size="sm">1. 有序列表项</Text>
          <Text size="sm" mt="xs">[链接文字](https://example.com)</Text>
          <Text size="sm">![图片](图片URL)</Text>
          <Text size="sm" mt="xs">&gt; 引用文本</Text>
          <Text size="sm" mt="xs">`代码`</Text>
          <Text size="sm">```代码块```</Text>
        </Stack>
      ),
    })
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <FileButton onChange={handleImageUpload} accept="image/*">
          {(props) => (
            <Button {...props} leftSection={<IconPhoto size={16} />} variant="light" size="xs">
              插入图片
            </Button>
          )}
        </FileButton>
        <Button
          leftSection={<IconBold size={16} />}
          variant="subtle"
          size="xs"
          onClick={() => insertAtCursor('**粗体文字**')}
        >
          粗体
        </Button>
        <Button
          leftSection={<IconItalic size={16} />}
          variant="subtle"
          size="xs"
          onClick={() => insertAtCursor('*斜体文字*')}
        >
          斜体
        </Button>
        <Button
          leftSection={<IconCode size={16} />}
          variant="subtle"
          size="xs"
          onClick={() => insertAtCursor('`代码`')}
        >
          代码
        </Button>
        <Button
          leftSection={<IconHelp size={16} />}
          variant="subtle"
          size="xs"
          onClick={showHelp}
        >
          帮助
        </Button>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={6}>
          <Stack gap="xs" h="100%">
            <Text size="sm" fw={500}>编辑</Text>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.currentTarget.value)}
              onPaste={handlePaste}
              placeholder={placeholder || '支持Markdown格式... 可直接粘贴图片'}
              rows={20}
              styles={{
                input: {
                  height: '500px',
                  minHeight: '500px',
                }
              }}
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap="xs" h="100%">
            <Text size="sm" fw={500}>预览</Text>
            <Paper
              withBorder
              p="md"
              style={{
                overflow: 'auto',
                height: '500px',
                minHeight: '500px',
              }}
            >
              {value ? (
                <ReactMarkdown
                  className="markdown-content"
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: imageRenderer
                  }}
                >
                  {value}
                </ReactMarkdown>
              ) : (
                <Text c="dimmed" size="sm">实时预览...</Text>
              )}
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
