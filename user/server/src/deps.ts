// アプリが使う「外部とのつながり」（DB・リアルタイム配信）をまとめたもの。
// app.ts で 1 回だけ作り、controller → service に渡す。テストでは別の DB や Notifier に差し替えられる。

import type { Database } from '@xclone/db'
import type { Notifier } from './realtime/notifier'

export interface AppDeps {
  db: Database
  notifier: Notifier
}
