import { Card as MantineCard, Text, Button, Group, Stack, Grid, Badge, Tooltip, Box, Menu, ActionIcon } from '@mantine/core'
import { IconEdit, IconTrash, IconClock, IconClockEdit, IconDots, IconArrowBarUp, IconArrowBarDown, IconCopy } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card } from '../api'
import '../styles/markdown.css'
import { Virtuoso } from 'react-virtuoso'

interface CardListProps {
  cards: Card[]
  onEdit: (card: Card) => void
  onDelete: (id: number) => void
  onInsertBefore?: (anchorId: number) => void
  onInsertAfter?: (anchorId: number) => void
}

// 自定义图片渲染器，将相对路径转换为完整URL
const imageRenderer = ({ src, alt }: { src?: string; alt?: string }) => {
  if (!src) return null

  // 如果是相对路径（以/uploads/开头），添加服务器地址
  const imageSrc = src.startsWith('/uploads/')
    ? `http://localhost:9908${src}`
    : src

  return <img src={imageSrc} alt={alt || '图片'} style={{ maxWidth: '100%' }} />
}

// 格式化时间显示
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function CardList({ cards, onEdit, onDelete, onInsertBefore, onInsertAfter }: CardListProps) {
  if (cards.length === 0) {
    return (
      <Text c="dimmed" ta="center" mt="xl" size="lg">
        还没有卡片，点击上方按钮创建第一张卡片
      </Text>
    )
  }

  const renderCard = (index: number) => {
    const card = cards[index]
    if (!card) {
      return null
    }

    const isLast = index === cards.length - 1
    return (
      <Box key={card.id} pb={isLast ? 0 : 12}>
        <MantineCard shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <Badge variant="filled" size="lg" color="gray">#{index + 1}</Badge>
              <Group gap={6}>
                <Text size="xs" c="dimmed">ID: {card.id}</Text>
                <Tooltip label="复制ID" withArrow>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    aria-label="复制ID"
                    onClick={() => navigator.clipboard?.writeText(String(card.id))}
                  >
                    <IconCopy size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Group>
          <Grid>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Badge variant="light" size="sm">正面</Badge>
                {card.front_text || card.front_image ? (
                  <Box style={{ fontSize: '0.875rem' }}>
                    {card.front_image && (
                      <img
                        src={`http://localhost:9908${card.front_image}`}
                        alt="正面图片"
                        style={{ maxWidth: '100%', marginBottom: '0.5rem' }}
                      />
                    )}
                    {card.front_text && (
                      <ReactMarkdown
                        className="markdown-content"
                        remarkPlugins={[remarkGfm]}
                        components={{ img: imageRenderer }}
                      >
                        {card.front_text}
                      </ReactMarkdown>
                    )}
                  </Box>
                ) : (
                  <Text size="sm" c="dimmed">无内容</Text>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Badge variant="light" size="sm" color="teal">反面</Badge>
                {card.back_text || card.back_image ? (
                  <Box style={{ fontSize: '0.875rem' }}>
                    {card.back_image && (
                      <img
                        src={`http://localhost:9908${card.back_image}`}
                        alt="背面图片"
                        style={{ maxWidth: '100%', marginBottom: '0.5rem' }}
                      />
                    )}
                    {card.back_text && (
                      <ReactMarkdown
                        className="markdown-content"
                        remarkPlugins={[remarkGfm]}
                        components={{ img: imageRenderer }}
                      >
                        {card.back_text}
                      </ReactMarkdown>
                    )}
                  </Box>
                ) : (
                  <Text size="sm" c="dimmed">无内容</Text>
                )}
              </Stack>
            </Grid.Col>
          </Grid>
          <Group justify="space-between" mt="md" align="center">
            <Group gap="md">
              <Tooltip label={`创建于: ${new Date(card.created_at).toLocaleString('zh-CN')}`}>
                <Group gap={4}>
                  <IconClock size={14} style={{ opacity: 0.6 }} />
                  <Text size="xs" c="dimmed">{formatDate(card.created_at)}</Text>
                </Group>
              </Tooltip>
              {card.updated_at !== card.created_at && (
                <Tooltip label={`修改于: ${new Date(card.updated_at).toLocaleString('zh-CN')}`}>
                  <Group gap={4}>
                    <IconClockEdit size={14} style={{ opacity: 0.6 }} />
                    <Text size="xs" c="dimmed">{formatDate(card.updated_at)}</Text>
                  </Group>
                </Tooltip>
              )}
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                leftSection={<IconEdit size={16} />}
                onClick={() => onEdit(card)}
                size="xs"
              >
                编辑
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => onDelete(card.id)}
                size="xs"
              >
                删除
              </Button>
              {(onInsertBefore || onInsertAfter) && (
                <Menu position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon variant="light" size="sm" aria-label="更多">
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {onInsertBefore && (
                      <Menu.Item leftSection={<IconArrowBarUp size={14} />} onClick={() => onInsertBefore!(card.id)}>
                        在前面插入
                      </Menu.Item>
                    )}
                    {onInsertAfter && (
                      <Menu.Item leftSection={<IconArrowBarDown size={14} />} onClick={() => onInsertAfter!(card.id)}>
                        在后面插入
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
        </MantineCard>
      </Box>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <Virtuoso
        style={{ flex: 1, height: '100%' }}
        totalCount={cards.length}
        itemContent={(index) => renderCard(index)}
        computeItemKey={(index) => String(cards[index]?.id ?? index)}
        overscan={6}
      />
    </div>
  )
}
