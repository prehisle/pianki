import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // 防止 Vite 在开发模式清屏
  clearScreen: false,

  server: {
    port: 3000,
    host: 'localhost',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9908',
        changeOrigin: true
      }
    }
  },

  // 优化构建配置
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  }
})
