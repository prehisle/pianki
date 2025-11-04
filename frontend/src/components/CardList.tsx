import { Card as MantineCard, Text, Button, Group, Stack, Grid, Badge, Tooltip } from '@mantine/core'
import { IconEdit, IconTrash, IconClock, IconClockEdit } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card } from '../api'

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

export default function CardList({ cards, onEdit, onDelete }: CardListProps) {
  if (cards.length === 0) {
    return (
      <Text c="dimmed" ta="center" mt="xl" size="lg">
        还没有卡片，点击上方按钮创建第一张卡片
      </Text>
    )
  }

  return (
    <Stack gap="md">
      {cards.map(card => (
        <MantineCard key={card.id} shadow="sm" padding="lg" radius="md" withBorder>
          <Grid>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Badge variant="light" size="sm">正面</Badge>
                {card.front_text ? (
                  <Text size="sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{ img: imageRenderer }}
                    >
                      {card.front_text}
                    </ReactMarkdown>
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">无内容</Text>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Badge variant="light" size="sm" color="teal">反面</Badge>
                {card.back_text ? (
                  <Text size="sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{ img: imageRenderer }}
                    >
                      {card.back_text}
                    </ReactMarkdown>
                  </Text>
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
            </Group>
          </Group>
        </MantineCard>
      ))}
    </Stack>
  )
}
