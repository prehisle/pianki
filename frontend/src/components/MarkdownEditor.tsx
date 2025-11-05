import { useRef, useState, useLayoutEffect } from 'react'
import {
  Textarea,
  Group,
  Paper,
  Text,
  Stack,
  Grid,
  FileButton,
  ActionIcon,
  Tooltip,
  Box
} from '@mantine/core'
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
  label?: string
}

export default function MarkdownEditor({ value, onChange, placeholder, label }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const turndownService = useRef(new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  }))

  const MIN_HEIGHT = 150
  const DEFAULT_RATIO = 0.25

  const getViewportHeight = () => (typeof window !== 'undefined' ? window.innerHeight : MIN_HEIGHT / DEFAULT_RATIO)

  const computeInitialHeight = () => {
    const viewportHeight = getViewportHeight()
    return Math.round(Math.max(MIN_HEIGHT, viewportHeight * DEFAULT_RATIO))
  }

  const clampHeight = (rawHeight: number) => Math.max(rawHeight, MIN_HEIGHT)

  const [syncedHeight, setSyncedHeight] = useState<number>(computeInitialHeight)

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

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    const container = previewContainerRef.current
    if (!container) return

    const paddingCompensation = 12

    const applyHeight = () => {
      const viewportBase = computeInitialHeight()

      const previousHeight = container.style.height
      container.style.height = 'auto'
      const contentHeight = container.scrollHeight
      container.style.height = previousHeight

      const rawHeight = contentHeight + paddingCompensation
      const desiredHeight = clampHeight(Math.max(viewportBase, rawHeight))

      setSyncedHeight((prev) => (Math.abs(prev - desiredHeight) > 1 ? desiredHeight : prev))
    }

    applyHeight()

    const observerTarget = container.firstElementChild as HTMLElement | null
    const observer = typeof ResizeObserver !== 'undefined' && observerTarget
      ? new ResizeObserver(applyHeight)
      : null
    if (observer && observerTarget) {
      observer.observe(observerTarget)
    }

    window.addEventListener('resize', applyHeight)

    return () => {
      window.removeEventListener('resize', applyHeight)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [value])

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
    <Stack gap="xs">
      {label && (
        <Text size="sm" fw={600}>
          {label}
        </Text>
      )}

      <Grid gutter={{ base: 'sm', md: 'md' }} align="stretch">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap={4} h="100%">
            <Box
              className="markdown-editor-area"
              style={{
                position: 'relative',
                border: '1px solid var(--mantine-color-gray-3)',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}
            >
              <Group
                gap={4}
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1px solid var(--mantine-color-gray-2)'
                }}
              >
              <FileButton onChange={handleImageUpload} accept="image/*">
                {(props) => (
                  <Tooltip label="插入图片" withArrow>
                    <ActionIcon
                      {...props}
                      variant="subtle"
                      size="sm"
                      aria-label="插入图片"
                    >
                      <IconPhoto size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </FileButton>

              <Tooltip label="粗体" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label="插入粗体"
                  onClick={() => insertAtCursor('**粗体文字**')}
                >
                  <IconBold size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="斜体" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label="插入斜体"
                  onClick={() => insertAtCursor('*斜体文字*')}
                >
                  <IconItalic size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="代码" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label="插入代码"
                  onClick={() => insertAtCursor('`代码`')}
                >
                  <IconCode size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="帮助" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label="打开帮助"
                  onClick={showHelp}
                >
                  <IconHelp size={16} />
                </ActionIcon>
              </Tooltip>
              </Group>

              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.currentTarget.value)}
                onPaste={handlePaste}
                placeholder={placeholder || '支持Markdown格式... 可直接粘贴图片'}
                variant="unstyled"
                styles={{
                  input: {
                    padding: '2.4rem 0.75rem 0.75rem',
                    height: `${syncedHeight}px`,
                    minHeight: `${MIN_HEIGHT}px`
                  }
                }}
              />
            </Box>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap={4} h="100%">
            <Paper
              ref={previewContainerRef}
              withBorder
              p="md"
              radius="md"
              style={{
                overflow: 'auto',
                height: `${syncedHeight}px`,
                minHeight: `${MIN_HEIGHT}px`
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
