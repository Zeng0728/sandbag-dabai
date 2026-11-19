import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发时把 /api 和 /storage 代理到本地 FastAPI（8000）
export default defineConfig({
  plugins: [react()],
  // 用相对路径，这样「域名根」和「子路径」两种静态托管都能跑
  // （Vercel/Netlify 根路径 OK，GitHub Pages 项目页 /sandbag-dabai/ 也 OK）
  base: './',
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/storage': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})