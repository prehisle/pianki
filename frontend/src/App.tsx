import { useState, useEffect, useMemo } from 'react'
import { AppShell, Title, Container, Button, Group, Text, Loader, Center, TextInput, Select, SegmentedControl, Anchor, Stack, Divider, Box } from '@mantine/core'
import { IconPlus, IconMail, IconBrandGithub, IconUsersGroup } from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { fetchDecks, fetchCards, createCard, updateCard, deleteCard, exportDeck, importDeck, createDeck, updateDeck, deleteDeck, Deck, Card, setBackendPort } from './api'
// 打开外部链接（Tauri 或 浏览器）
let openExternal: (url: string) => void = (url: string) => {
  try {
    // 尝试使用 Tauri opener 插件
    // 动态 import，避免非 Tauri 环境报错
    // @ts-ignore
    import('@tauri-apps/plugin-opener').then(m => m.open(url)).catch(() => window.open(url, '_blank'))
  } catch {
    window.open(url, '_blank')
  }
}
import CardEditor from './components/CardEditor'
import CardList from './components/CardList'
import DeckSelector from './components/DeckSelector'
import ConfirmDialog from './components/ConfirmDialog'
import ConnectionStatus from './components/ConnectionStatus'

function App() {
  const [backendConnected, setBackendConnected] = useState(false)
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
  const [switchDeckConfirm, setSwitchDeckConfirm] = useState<{ isOpen: boolean; targetDeckId: number | null }>({
    isOpen: false,
    targetDeckId: null
  })
  const [sortBy, setSortBy] = useState<'custom' | 'created' | 'updated'>('custom')
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const appVersion = '0.1.19'

  // 根据排序选项对卡片进行排序
  const displayCards = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cards
    return cards.filter(c => {
      const f = (c.front_text || '').toLowerCase()
      const b = (c.back_text || '').toLowerCase()
      return f.includes(q) || b.includes(q) || String(c.id).includes(q)
    })
  }, [cards, query])

  // 加载牌组列表
  useEffect(() => {
    loadDecks()
  }, [])

  // 根据牌组/排序变更加载卡片
  useEffect(() => {
    if (currentDeckId) {
      loadCards()
    }
  }, [currentDeckId, sortBy, sortOrder])

  // 响应 Tauri 顶栏菜单事件（open-feedback / open-about）
  // 注意：Hooks 必须在组件最外层调用，不能放在条件 return 之后
  useEffect(() => {
    const g: any = (window as any).__TAURI__
    if (g?.event?.listen) {
      const unsubs: Array<() => void> = []
      g.event.listen('open-feedback', () => openFeedback()).then((unsub: any) => unsubs.push(unsub)).catch(() => {})
      g.event.listen('open-about', () => openAbout()).then((unsub: any) => unsubs.push(unsub)).catch(() => {})
      g.event.listen('backend-ready', (e: any) => {
        const p = Number(e?.payload)
        if (Number.isFinite(p)) setBackendPort(p)
      }).then((unsub: any) => unsubs.push(unsub)).catch(() => {})
      return () => unsubs.forEach(fn => {
        try { fn() } catch {}
      })
    }
  }, [])

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
      const data = await fetchCards(currentDeckId, sortBy, sortOrder)
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
        const insert = (window as any).__PIANKI_INSERT__ as { anchorId: number; position: 'before' | 'after' } | undefined
        const payload: any = { ...cardData, deck_id: currentDeckId }
        if (insert) {
          if (insert.position === 'before') payload.insert_before_id = insert.anchorId
          if (insert.position === 'after') payload.insert_after_id = insert.anchorId
        }
        await createCard(payload)
      }
      await loadCards()
      await loadDecks() // 重新加载牌组列表以更新卡片计数
      setEditingCard(null)
      setIsCreating(false)
      ;(window as any).__PIANKI_INSERT__ = undefined
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

    const notificationId = `export-${Date.now()}`
    notifications.show({
      id: notificationId,
      title: '导出中',
      message: '正在准备导出...',
      color: 'blue',
      loading: true,
      autoClose: false
    })

    try {
      const blob = await exportDeck(currentDeckId)
      const deckName = decks.find(d => d.id === currentDeckId)?.name || 'deck'

      const tauriGlobals = window as any
      const isTauri = Boolean(tauriGlobals?.__TAURI__ || tauriGlobals?.__TAURI_IPC__)
      if (isTauri) {
        // 桌面端：弹保存对话框并写入文件
        const [{ save }, { writeFile }] = await Promise.all([
          import('@tauri-apps/plugin-dialog'),
          import('@tauri-apps/plugin-fs')
        ])
        const suggested = `${deckName}.apkg`
        const targetPath = await save({
          defaultPath: suggested,
          filters: [{ name: 'Anki Package', extensions: ['apkg'] }]
        })
        if (!targetPath) {
          notifications.update({
            id: notificationId,
            title: '已取消',
            message: '已取消导出',
            color: 'yellow',
            loading: false,
            autoClose: 2000
          })
          return
        }
        const buffer = new Uint8Array(await blob.arrayBuffer())
        await writeFile(targetPath, buffer)
        notifications.update({
          id: notificationId,
          title: '成功',
          message: `已保存到：${targetPath}`,
          color: 'green',
          loading: false,
          autoClose: 4000
        })
      } else {
        // 浏览器端：使用 a[href] 触发下载
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${deckName}.apkg`
        a.click()
        window.URL.revokeObjectURL(url)
        // 浏览器环境下无法得知用户何时保存完成，所以在触发下载后立即更新通知
        notifications.update({
          id: notificationId,
          title: '准备就绪',
          message: '请在浏览器对话框中选择保存位置',
          color: 'blue',
          loading: false,
          autoClose: 4000
        })
      }
    } catch (error) {
      console.error('导出失败:', error)
      notifications.update({
        id: notificationId,
        title: '错误',
        message: '导出失败: ' + (error as Error).message,
        color: 'red',
        loading: false,
        autoClose: 4000
      })
    }
  }

  const handleImport = async (file: File) => {
    try {
      setLoading(true)
      const result = await importDeck(file)
      await loadDecks()

      // 清除编辑状态，然后自动选中导入的牌组
      setEditingCard(null)
      setIsCreating(false)
      setCurrentDeckId(result.deck.id)

      notifications.show({
        title: '成功',
        message: `成功导入牌组"${result.deck.name}"，共${result.cardsImported}张卡片`,
        color: 'green',
      })
    } catch (error) {
      console.error('导入失败:', error)
      notifications.show({
        title: '错误',
        message: '导入失败: ' + (error as Error).message,
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  const openFeedback = () => {
    const email = 'prehisle@gmail.com'
    const qqGroup = '188193559'
    modals.open({
      title: '反馈与支持',
      children: (
        <Stack gap="xs">
          <Group>
            <IconMail size={18} />
            <Anchor href={`mailto:${email}?subject=${encodeURIComponent('Pianki 反馈 ' + appVersion)}`} target="_blank">
              发送邮件：{email}
            </Anchor>
          </Group>
          <Group>
            <IconBrandGithub size={18} />
            <Anchor onClick={() => openExternal('https://github.com/prehisle/pianki/issues/new/choose')}>GitHub Issues（报告问题/提建议）</Anchor>
          </Group>
          <Group>
            <IconBrandGithub size={18} />
            <Anchor onClick={() => openExternal('https://github.com/prehisle/pianki/discussions')}>GitHub Discussions（讨论/使用交流）</Anchor>
          </Group>
          <Group>
            <IconUsersGroup size={18} />
            <Text size="sm">QQ群：{qqGroup} <Anchor onClick={() => {
              navigator.clipboard?.writeText(qqGroup)
              notifications.show({ title: '已复制', message: 'QQ群号已复制到剪贴板', color: 'green' })
            }}>复制</Anchor></Text>
          </Group>
          <Text c="dimmed" size="xs">提交问题时请尽量附上复现步骤与截图。</Text>
        </Stack>
      )
    })
  }

  const openAbout = () => {
    const email = 'prehisle@gmail.com'
    const qqGroup = '188193559'
    modals.open({
      title: '关于 Pianki',
      children: (
        <Stack gap="xs">
          <Text size="sm">版本：{appVersion}</Text>
          <Text size="sm">Pianki 是一个专注于高效制作与导出 Anki 卡片的开源工具。</Text>
          <Divider my={6} />
          <Group>
            <IconBrandGithub size={18} />
            <Anchor onClick={() => openExternal('https://github.com/prehisle/pianki')}>项目主页（GitHub）</Anchor>
          </Group>
          <Group>
            <IconMail size={18} />
            <Anchor href={`mailto:${email}?subject=${encodeURIComponent('Pianki 反馈 ' + appVersion)}`} target="_blank">
              联系邮箱：{email}
            </Anchor>
          </Group>
          <Group>
            <IconUsersGroup size={18} />
            <Text size="sm">QQ群：{qqGroup}（点击复制）</Text>
            <Button size="xs" variant="light" onClick={() => {
              navigator.clipboard?.writeText(qqGroup)
              notifications.show({ title: '已复制', message: 'QQ群号已复制到剪贴板', color: 'green' })
            }}>复制</Button>
          </Group>
          <Text c="dimmed" size="xs">Copyright © Pianki Contributors</Text>
        </Stack>
      )
    })
  }

  // 处理牌组切换
  const handleSelectDeck = (deckId: number) => {
    // 如果正在编辑或创建卡片，提示用户
    if (isCreating || editingCard) {
      setSwitchDeckConfirm({ isOpen: true, targetDeckId: deckId })
    } else {
      // 直接切换
      setCurrentDeckId(deckId)
    }
  }

  // 确认切换牌组（放弃当前编辑）
  const confirmSwitchDeck = () => {
    if (switchDeckConfirm.targetDeckId) {
      setCurrentDeckId(switchDeckConfirm.targetDeckId)
      setEditingCard(null)
      setIsCreating(false)
      setSwitchDeckConfirm({ isOpen: false, targetDeckId: null })
    }
  }

  // 检查后端连接状态
  if (!backendConnected) {
    return <ConnectionStatus onConnected={() => setBackendConnected(true)} />
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 280, breakpoint: 'sm' }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={2}>📚 Pianki - Anki卡片制作工具</Title>
          <div style={{ flex: 1 }} />
          <Group gap="xs">
            <Button variant="light" size="xs" onClick={openFeedback}>反馈与支持</Button>
            <Button variant="subtle" size="xs" onClick={openAbout}>关于</Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <DeckSelector
          decks={decks}
          currentDeckId={currentDeckId}
          onSelectDeck={handleSelectDeck}
          onCreateDeck={handleCreateDeck}
          onRenameDeck={handleRenameDeck}
          onDeleteDeck={handleDeleteDeck}
          onExport={handleExport}
          onImport={handleImport}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Container
          fluid
          px="sm"
          py="xs"
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
        >
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
                    ;(window as any).__PIANKI_INSERT__ = undefined
                  }}
                />
              ) : (
                <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
                  <Box
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 5,
                      backgroundColor: 'var(--mantine-color-body)',
                      borderBottom: '1px solid var(--mantine-color-gray-2)',
                      paddingBottom: '0.375rem',
                      marginBottom: '0.5rem'
                    }}
                  >
                  <Group justify="space-between">
                    <Button
                      leftSection={<IconPlus size={16} />}
                      onClick={() => setIsCreating(true)}
                    >
                      新建卡片
                    </Button>
                    <Group gap="xs">
                      <TextInput
                        placeholder="搜索 正面/反面/ID"
                        value={query}
                        onChange={(e) => setQuery(e.currentTarget.value)}
                        size="xs"
                        w={220}
                      />
                      <Select
                        value={sortBy}
                        onChange={(value) => setSortBy((value as any) || 'custom')}
                        data={[
                          { value: 'custom', label: '自定义顺序' },
                          { value: 'created', label: '创建时间' },
                          { value: 'updated', label: '修改时间' }
                        ]}
                        size="xs"
                        w={110}
                      />
                      <SegmentedControl
                        value={sortOrder}
                        onChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                        data={[
                          { value: 'desc', label: '↓' },
                          { value: 'asc', label: '↑' }
                        ]}
                        size="xs"
                      />
                      <Text c="dimmed" size="sm">
                        共 {displayCards.length}/{cards.length} 张
                      </Text>
                    </Group>
                  </Group>
                  </Box>

                  <Box style={{ flex: 1, minHeight: 0 }}>
                    {loading ? (
                      <Center h="100%">
                        <Loader />
                      </Center>
                    ) : (
                      <CardList
                        cards={displayCards}
                        onEdit={setEditingCard}
                        onDelete={handleDeleteCard}
                        onInsertBefore={(anchorId) => {
                          setIsCreating(true)
                          // 临时保存到全局 window 以简化最小实现
                          ;(window as any).__PIANKI_INSERT__ = { anchorId, position: 'before' }
                        }}
                        onInsertAfter={(anchorId) => {
                          setIsCreating(true)
                          ;(window as any).__PIANKI_INSERT__ = { anchorId, position: 'after' }
                        }}
                      />
                    )}
                  </Box>
                </Stack>
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

      <ConfirmDialog
        isOpen={switchDeckConfirm.isOpen}
        title="切换牌组"
        message={`您正在${editingCard ? '编辑' : '创建'}卡片，切换牌组将会放弃当前的编辑内容。确定要继续吗？`}
        confirmText="放弃并切换"
        cancelText="取消"
        type="warning"
        onConfirm={confirmSwitchDeck}
        onCancel={() => setSwitchDeckConfirm({ isOpen: false, targetDeckId: null })}
      />
    </AppShell>
  )
}

export default App
