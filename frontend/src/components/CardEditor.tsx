import { useState } from 'react'
import { Stack, Title, Button, Group, ScrollArea } from '@mantine/core'
import { IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { Card } from '../api'
import MarkdownEditor from './MarkdownEditor'

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
    <form
      onSubmit={handleSubmit}
      style={{
        height: 'calc(100vh - 125px)',
        minHeight: '480px'
      }}
    >
      <Stack gap="sm" h="100%" style={{ overflow: 'hidden' }}>
        <Group
          justify="space-between"
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 100,
            padding: '0.5rem 0 0.25rem',
            marginBottom: '0.125rem',
            borderBottom: '1px solid #f1f3f5'
          }}
        >
          <Title order={3} style={{ margin: 0 }}>{card ? '编辑卡片' : '新建卡片'}</Title>
          <Group>
            <Button variant="default" leftSection={<IconX size={16} />} onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />}>
              保存
            </Button>
          </Group>
        </Group>

        <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars type="auto">
          <Stack gap="sm" pb="sm">
            <MarkdownEditor
              label="正面"
              value={frontText}
              onChange={setFrontText}
              placeholder="输入卡片正面内容... 支持Markdown格式和图片"
            />

            <MarkdownEditor
              label="背面"
              value={backText}
              onChange={setBackText}
              placeholder="输入卡片背面内容... 支持Markdown格式和图片"
            />
          </Stack>
        </ScrollArea>
      </Stack>
    </form>
  )
}
