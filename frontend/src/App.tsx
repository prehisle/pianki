import { useState, useEffect } from 'react'
import { AppShell, Title, Container, Button, Group, Text, Loader, Center } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
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
      alert('加载牌组失败')
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
      alert('加载卡片失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDeck = async () => {
    const name = prompt('请输入新牌组名称:')
    if (!name) return

    try {
      await createDeck({ name })
      await loadDecks()
    } catch (error) {
      console.error('创建牌组失败:', error)
      alert('创建牌组失败')
    }
  }

  const handleRenameDeck = async (id: number) => {
    const deck = decks.find(d => d.id === id)
    if (!deck) return

    const newName = prompt('请输入新名称:', deck.name)
    if (!newName || newName === deck.name) return

    try {
      await updateDeck(id, { name: newName, description: deck.description })
      await loadDecks()
    } catch (error) {
      console.error('重命名牌组失败:', error)
      alert('重命名牌组失败')
    }
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
    } catch (error) {
      console.error('删除牌组失败:', error)
      alert('删除牌组失败')
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
    } catch (error) {
      console.error('保存卡片失败:', error)
      alert('保存卡片失败')
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
    } catch (error) {
      console.error('删除卡片失败:', error)
      alert('删除卡片失败')
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
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败: ' + (error as Error).message)
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
