import { useState, useEffect } from 'react'
import { AppShell, Title, Container, Button, Group, Text, Loader, Center, TextInput } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { fetchDecks, fetchCards, createCard, updateCard, deleteCard, exportDeck, createDeck, updateDeck, deleteDeck, Deck, Card } from './api'
import CardEditor from './components/CardEditor'
import CardList from './components/CardList'
import DeckSelector from './components/DeckSelector'
import ConfirmDialog from './components/ConfirmDialog'

function App() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [currentDeckId, setCurrentDeckId] = useState<number | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; cardId: number | null }>({
    isOpen: false,
    cardId: null
  })
  const [deleteDeckConfirm, setDeleteDeckConfirm] = useState<{ isOpen: boolean; deckId: number | null }>({
    isOpen: false,
    deckId: null
  })

  // 加载牌组列表
  useEffect(() => {
    loadDecks()
  }, [])

  // 当选择牌组时加载卡片
  useEffect(() => {
    if (currentDeckId) {
      loadCards()
    }
  }, [currentDeckId])

  const loadDecks = async () => {
    try {
      const data = await fetchDecks()
      setDecks(data)
      if (data.length > 0 && !currentDeckId) {
        setCurrentDeckId(data[0].id)
      }
    } catch (error) {
      console.error('加载牌组失败:', error)
      notifications.show({
        title: '错误',
        message: '加载牌组失败',
        color: 'red',
      })
    }
  }

  const loadCards = async () => {
    if (!currentDeckId) return
    setLoading(true)
    try {
      const data = await fetchCards(currentDeckId)
      setCards(data)
    } catch (error) {
      console.error('加载卡片失败:', error)
      notifications.show({
        title: '错误',
        message: '加载卡片失败',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDeck = async () => {
    modals.openConfirmModal({
      title: '创建新牌组',
      children: (
        <TextInput
          label="牌组名称"
          placeholder="请输入牌组名称"
          data-autofocus
          id="deck-name-input"
        />
      ),
      labels: { confirm: '创建', cancel: '取消' },
      onConfirm: async () => {
        const input = document.getElementById('deck-name-input') as HTMLInputElement
        const name = input?.value.trim()
        if (!name) return

        try {
          await createDeck({ name })
          await loadDecks()
          notifications.show({
            title: '成功',
            message: '牌组创建成功',
            color: 'green',
          })
        } catch (error) {
          console.error('创建牌组失败:', error)
          notifications.show({
            title: '错误',
            message: '创建牌组失败',
            color: 'red',
          })
        }
      },
    })
  }

  const handleRenameDeck = async (id: number) => {
    const deck = decks.find(d => d.id === id)
    if (!deck) return

    modals.openConfirmModal({
      title: '重命名牌组',
      children: (
        <TextInput
          label="新名称"
          placeholder="请输入新名称"
          defaultValue={deck.name}
          data-autofocus
          id="deck-rename-input"
        />
      ),
      labels: { confirm: '确定', cancel: '取消' },
      onConfirm: async () => {
        const input = document.getElementById('deck-rename-input') as HTMLInputElement
        const newName = input?.value.trim()
        if (!newName || newName === deck.name) return

        try {
          await updateDeck(id, { name: newName, description: deck.description })
          await loadDecks()
          notifications.show({
            title: '成功',
            message: '牌组重命名成功',
            color: 'green',
          })
        } catch (error) {
          console.error('重命名牌组失败:', error)
          notifications.show({
            title: '错误',
            message: '重命名牌组失败',
            color: 'red',
          })
        }
      },
    })
  }

  const handleDeleteDeck = (id: number) => {
    setDeleteDeckConfirm({ isOpen: true, deckId: id })
  }

  const confirmDeleteDeck = async () => {
    if (!deleteDeckConfirm.deckId) return

    try {
      await deleteDeck(deleteDeckConfirm.deckId)

      // 如果删除的是当前选中的牌组，清除选中状态
      if (currentDeckId === deleteDeckConfirm.deckId) {
        setCurrentDeckId(null)
        setCards([])
      }

      await loadDecks()
      notifications.show({
        title: '成功',
        message: '牌组已删除',
        color: 'green',
      })
    } catch (error) {
      console.error('删除牌组失败:', error)
      notifications.show({
        title: '错误',
        message: '删除牌组失败',
        color: 'red',
      })
    }
  }

  const handleSaveCard = async (cardData: Partial<Card>) => {
    if (!currentDeckId) return

    try {
      if (editingCard) {
        await updateCard(editingCard.id, cardData)
      } else {
        await createCard({ ...cardData, deck_id: currentDeckId })
      }
      await loadCards()
      await loadDecks() // 重新加载牌组列表以更新卡片计数
      setEditingCard(null)
      setIsCreating(false)
      notifications.show({
        title: '成功',
        message: editingCard ? '卡片已更新' : '卡片已创建',
        color: 'green',
      })
    } catch (error) {
      console.error('保存卡片失败:', error)
      notifications.show({
        title: '错误',
        message: '保存卡片失败',
        color: 'red',
      })
    }
  }

  const handleDeleteCard = (id: number) => {
    setDeleteConfirm({ isOpen: true, cardId: id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.cardId) return

    try {
      await deleteCard(deleteConfirm.cardId)
      await loadCards()
      await loadDecks() // 重新加载牌组列表以更新卡片计数
      notifications.show({
        title: '成功',
        message: '卡片已删除',
        color: 'green',
      })
    } catch (error) {
      console.error('删除卡片失败:', error)
      notifications.show({
        title: '错误',
        message: '删除卡片失败',
        color: 'red',
      })
    }
  }

  const handleExport = async () => {
    if (!currentDeckId) return

    try {
      const blob = await exportDeck(currentDeckId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const deckName = decks.find(d => d.id === currentDeckId)?.name || 'deck'
      a.download = `${deckName}.apkg`
      a.click()
      window.URL.revokeObjectURL(url)
      notifications.show({
        title: '成功',
        message: '导出成功',
        color: 'green',
      })
    } catch (error) {
      console.error('导出失败:', error)
      notifications.show({
        title: '错误',
        message: '导出失败: ' + (error as Error).message,
        color: 'red',
      })
    }
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 280, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={2}>📚 Pianki - Anki卡片制作工具</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <DeckSelector
          decks={decks}
          currentDeckId={currentDeckId}
          onSelectDeck={setCurrentDeckId}
          onCreateDeck={handleCreateDeck}
          onRenameDeck={handleRenameDeck}
          onDeleteDeck={handleDeleteDeck}
          onExport={handleExport}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl">
          {!currentDeckId ? (
            <Center h={400}>
              <Text c="dimmed" size="lg">请先创建或选择一个牌组</Text>
            </Center>
          ) : (
            <>
              {(isCreating || editingCard) ? (
                <CardEditor
                  card={editingCard}
                  onSave={handleSaveCard}
                  onCancel={() => {
                    setEditingCard(null)
                    setIsCreating(false)
                  }}
                />
              ) : (
                <>
                  <Group justify="space-between" mb="md">
                    <Button
                      leftSection={<IconPlus size={16} />}
                      onClick={() => setIsCreating(true)}
                    >
                      新建卡片
                    </Button>
                    <Text c="dimmed" size="sm">
                      共 {cards.length} 张卡片
                    </Text>
                  </Group>

                  {loading ? (
                    <Center h={200}>
                      <Loader />
                    </Center>
                  ) : (
                    <CardList
                      cards={cards}
                      onEdit={setEditingCard}
                      onDelete={handleDeleteCard}
                    />
                  )}
                </>
              )}
            </>
          )}
        </Container>
      </AppShell.Main>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="确认删除"
        message="确定要删除这张卡片吗？删除后将无法恢复。"
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, cardId: null })}
      />

      <ConfirmDialog
        isOpen={deleteDeckConfirm.isOpen}
        title="确认删除牌组"
        message="确定要删除这个牌组吗？牌组中的所有卡片也将被删除，此操作无法恢复。"
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmDeleteDeck}
        onCancel={() => setDeleteDeckConfirm({ isOpen: false, deckId: null })}
      />
    </AppShell>
  )
}

export default App
