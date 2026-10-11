// DB の接続設定。接続先は環境変数 DATABASE_URL で決める。
// ルートの .env があれば自動で読み込む（無くても、開発用の既定値で動くようにしてある）。

import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 開発用の既定値（docker-compose.yml / .env.example と同じ）。本番では使わない */
const DEFAULT_DEV_DATABASE_URL = 'postgresql://postgres:test999@localhost:5432/xclone'

/** リポジトリ直下の .env を読み込む。ファイルが無い場合は何もしない */
function loadRootEnvFile() {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)))
  } catch {
    // .env が無いのは正常（既定値か、シェルの環境変数を使う）
  }
}

loadRootEnvFile()

/** 接続文字列を返す。本番で DATABASE_URL が未設定なら、安全のため起動を止める */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (url) return url
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL が設定されていません（本番では必須です）')
  }
  return DEFAULT_DEV_DATABASE_URL
}
