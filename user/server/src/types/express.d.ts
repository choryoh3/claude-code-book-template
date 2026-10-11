// Express の Request に「ログイン中のユーザー」（req.auth）を追加する型定義。
// 認証ミドルウェア（middlewares/auth.ts）が設定し、controller は getAuth(req) で取り出す。
//
// Express の型は、グローバルの `Express.Request` を Request に合成する仕組みになっているので、そこに追加する。
// （pnpm では express-serve-static-core を直接参照できないため、`declare module` での拡張は効かない）

import type { USER_ROLES } from '@xclone/shared'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        role: (typeof USER_ROLES)[number]
      }
    }
  }
}

export {}
