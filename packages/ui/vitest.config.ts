// コンポーネントのテスト設定。Vue の .vue ファイルを読めるようにし、ブラウザの代わりに happy-dom を使う。
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
  },
})
