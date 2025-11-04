import { useState } from 'react'
import { Stack, Title, Button, Group, Alert } from '@mantine/core'
import { IconInfoCircle, IconDeviceFloppy, IconX } from '@tabler/icons-react'
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
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <Group
          justify="space-between"
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 100,
            padding: '1rem 0',
            marginBottom: '0.5rem',
            borderBottom: '1px solid #e9ecef'
          }}
        >
          <Title order={2}>{card ? '编辑卡片' : '新建卡片'}</Title>
          <Group>
            <Button variant="default" leftSection={<IconX size={16} />} onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />}>
              保存
            </Button>
          </Group>
        </Group>

        <Alert variant="light" color="blue" icon={<IconInfoCircle />}>
          在编辑器中可以直接粘贴图片或点击"插入图片"按钮
        </Alert>

        <Stack gap="md">
          <Title order={4}>正面</Title>
          <MarkdownEditor
            value={frontText}
            onChange={setFrontText}
            placeholder="输入卡片正面内容... 支持Markdown格式和图片"
          />
        </Stack>

        <Stack gap="md">
          <Title order={4}>背面</Title>
          <MarkdownEditor
            value={backText}
            onChange={setBackText}
            placeholder="输入卡片背面内容... 支持Markdown格式和图片"
          />
        </Stack>
      </Stack>
    </form>
  )
}
