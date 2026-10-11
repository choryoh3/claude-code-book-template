// Vite（開発サーバー・ビルド）と Vitest（テスト）の設定。
//
// 開発中は /api・/uploads・/socket.io を user/server（http://localhost:3000）へ転送（proxy）する。
// 画面と API が「同じオリジン」に見えるので、refresh token の Cookie がそのまま使え、CORS の設定も要らない。
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const API_SERVER = 'http://localhost:3000'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    // `@/stores/auth` のように、src からのパスで import できるようにする（../../ の連鎖を避ける）
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': API_SERVER,
      '/uploads': API_SERVER,
      '/socket.io': { target: API_SERVER, ws: true },
    },
  },
  test: {
    environment: 'happy-dom',
  },
})
