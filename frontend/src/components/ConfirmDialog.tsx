import { Modal, Button, Text, Group, Stack } from '@mantine/core'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'warning'
}: ConfirmDialogProps) {
  const getIcon = () => {
    switch (type) {
      case 'danger': return '🗑️'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '⚠️'
    }
  }

  const getColor = () => {
    switch (type) {
      case 'danger': return 'red'
      case 'warning': return 'orange'
      case 'info': return 'blue'
      default: return 'orange'
    }
  }

  return (
    <Modal
      opened={isOpen}
      onClose={onCancel}
      title={title}
      centered
      size="sm"
    >
      <Stack gap="md">
        <div style={{ fontSize: '3rem', textAlign: 'center' }}>
          {getIcon()}
        </div>
        <Text size="sm" c="dimmed" ta="center">
          {message}
        </Text>
        <Group justify="center" gap="sm" mt="md">
          <Button variant="default" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            color={getColor()}
            onClick={() => {
              onConfirm()
              onCancel()
            }}
          >
            {confirmText}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
