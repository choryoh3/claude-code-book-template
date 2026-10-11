// API テストの設定（Vitest + Supertest + 実際の PostgreSQL）。
//
// テストは開発用の DB とは別の「xclone_test」を使う（テストのたびに全データを消すため）。
// 接続先は環境変数 TEST_DATABASE_URL で変えられる（CI では PostgreSQL のサービスに向ける）。

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'vitest/config'

const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:test999@localhost:5432/xclone_test',
  // ログイン試行回数の制限は、テストでは実質無効にする（同じ IP から何度もログインするため）
  AUTH_RATE_LIMIT_PER_MINUTE: '100000',
  UPLOAD_DIR: join(tmpdir(), 'xclone-test-uploads'),
}

// ⚠ `test.env` はテストの実行側にしか渡らず、全体の準備（globalSetup）には届かない。
// そのため、設定の読み込み時に環境変数そのものを書き換えて、どちらにも同じ値が見えるようにする。
// （.env の DATABASE_URL より優先される: 先に設定された環境変数は .env で上書きされないため）
Object.assign(process.env, TEST_ENV)

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // テスト用 DB を作り、最新のマイグレーションを適用する（全テストの前に 1 回）
    globalSetup: ['./test/global-setup.ts'],
    env: TEST_ENV,
    // 全てのテストファイルが同じ DB を使うので、同時に動かさない（互いのデータを消し合わないように）
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
