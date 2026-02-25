import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/feishu-plugin/',   // ⚠️ 必须和仓库名一致
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }
})