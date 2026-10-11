// リクエストごとの情報（requestId・ログイン中のユーザー ID）を、関数の引数で受け渡さずに参照できるようにする。
// AsyncLocalStorage は「この非同期処理の流れの中だけで有効な入れ物」。ログに requestId を自動で付けるのに使う。

import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
  requestId: string
  userId?: string
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

/** 今処理中のリクエストの情報（リクエストの外では undefined） */
export function currentContext(): RequestContext | undefined {
  return requestContext.getStore()
}
