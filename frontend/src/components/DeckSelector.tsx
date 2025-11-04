import { Stack, Title, Button, Group, NavLink, ActionIcon, Text, FileButton } from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconPackageExport, IconPackageImport } from '@tabler/icons-react'
import { Deck } from '../api'

interface DeckSelectorProps {
  decks: Deck[]
  currentDeckId: number | null
  onSelectDeck: (id: number) => void
  onCreateDeck: () => void
  onRenameDeck: (id: number) => void
  onDeleteDeck: (id: number) => void
  onExport: () => void
  onImport: (file: File) => void
}

export default function DeckSelector({
  decks,
  currentDeckId,
  onSelectDeck,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onExport,
  onImport
}: DeckSelectorProps) {
  return (
    <Stack gap="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between">
        <Title order={3}>牌组</Title>
        <ActionIcon variant="filled" onClick={onCreateDeck}>
          <IconPlus size={18} />
        </ActionIcon>
      </Group>

      <Stack gap="xs" style={{ flex: 1, overflow: 'auto' }}>
        {decks.map(deck => (
          <NavLink
            key={deck.id}
            label={
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>{deck.name}</Text>
                <Group gap={4}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRenameDeck(deck.id)
                    }}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteDeck(deck.id)
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            }
            description={`${deck.card_count || 0} 张卡片`}
            active={currentDeckId === deck.id}
            onClick={() => onSelectDeck(deck.id)}
          />
        ))}
      </Stack>

      <Stack gap="xs">
        <FileButton onChange={(file) => file && onImport(file)} accept=".apkg">
          {(props) => (
            <Button
              {...props}
              fullWidth
              leftSection={<IconPackageImport size={16} />}
              variant="light"
              color="blue"
            >
              导入 .apkg
            </Button>
          )}
        </FileButton>

        {currentDeckId && (
          <Button
            fullWidth
            leftSection={<IconPackageExport size={16} />}
            onClick={onExport}
            color="green"
          >
            导出为 .apkg
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
