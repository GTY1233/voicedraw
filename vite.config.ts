import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端 5173，后端代理 8787；/api 转发到后端，密钥只在后端
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true, // 代理实时语音识别的 WebSocket (/api/asr)
      },
    },
  },
})
