/// <reference types="vite/client" />

// Vue のルートに付ける追加情報（router/index.ts の meta）
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** ログインが必要な画面 */
    requiresAuth?: boolean
    /** ログイン済みなら見せない画面（ログイン・登録） */
    guestOnly?: boolean
    /** 3 カラムのレイアウトを使わない画面（ログイン・登録） */
    bareLayout?: boolean
  }
}
