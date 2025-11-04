import { useEffect, useState } from 'react'
import { Alert, Loader, Stack, Text, Code, Button } from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'

interface ConnectionStatusProps {
  onConnected: () => void
}

export default function ConnectionStatus({ onConnected }: ConnectionStatusProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('后端健康检查:', data)
        setIsConnected(true)
        setError('')
        onConnected() // 通知父组件连接成功
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err: any) {
      console.error('连接后端失败:', err)
      setIsConnected(false)
      setError(err.message || '无法连接到后端服务器')
    }
  }

  useEffect(() => {
    // 初始检查
    checkConnection()

    // 如果连接失败，定期重试
    const interval = setInterval(() => {
      if (isConnected === false) {
        setRetryCount(prev => prev + 1)
        checkConnection()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isConnected])

  // 正在检查连接
  if (isConnected === null) {
    return (
      <Stack align="center" justify="center" style={{ height: '100vh' }} gap="md">
        <Loader size="lg" />
        <Text size="lg">正在连接到 Pianki 服务器...</Text>
        <Text size="sm" c="dimmed">首次启动可能需要几秒钟</Text>
      </Stack>
    )
  }

  // 连接失败
  if (isConnected === false) {
    const appDataDir = navigator.userAgent.includes('Windows')
      ? '%APPDATA%\\com.pianki.app'
      : navigator.userAgent.includes('Mac')
      ? '~/Library/Application Support/com.pianki.app'
      : '~/.config/com.pianki.app'

    return (
      <Stack align="center" justify="center" style={{ height: '100vh', padding: '2rem' }} gap="md">
        <Alert
          variant="filled"
          color="red"
          title="无法连接到后端服务器"
          icon={<IconAlertCircle size={24} />}
          style={{ maxWidth: 600 }}
        >
          <Stack gap="xs">
            <Text size="sm">
              Pianki 无法连接到本地后端服务器 (http://localhost:3001)
            </Text>

            <Text size="sm" fw={700}>错误信息:</Text>
            <Code block color="red">{error}</Code>

            <Text size="sm" fw={700} mt="md">重试次数: {retryCount}</Text>

            <Text size="sm" mt="md" fw={700}>如何查看日志？</Text>
            <Text size="sm">
              后端日志文件位置：
            </Text>
            <Code block>{appDataDir}\\pianki-backend.log</Code>

            <Text size="sm" mt="sm">
              请按 Win+R 打开运行对话框，输入上述路径（去掉文件名），按回车打开文件夹。
            </Text>

            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                setRetryCount(0)
                checkConnection()
              }}
              mt="md"
            >
              立即重试
            </Button>

            <Button
              variant="subtle"
              onClick={() => window.location.reload()}
              mt="xs"
            >
              重新加载应用
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  // 连接成功，不显示任何内容（让主应用接管）
  return null
}
