// E2E テスト（Playwright）の設定。
//
// テストのたびに、専用の DB（xclone_e2e）と専用のポート（API 3100 / 画面 5273）で、API と画面を新しく起動する。
// 開発中に動かしているサーバー（3000 / 5173）や開発用の DB には一切触れない。
//   起動の流れ: E2E 用の DB を作り直す（prepare-db.ts）→ user/server を起動 → user/client を起動 → テスト

import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:test999@localhost:5432/xclone_e2e'
const API_PORT = 3100
const CLIENT_PORT = 5273

export default defineConfig({
  testDir: './tests',
  // 全テストが同じ DB を使うので、順番に 1 つずつ動かす
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // 1 件のテストで 2 人が登録する（パスワードのハッシュ化を含む）ので、制限時間は長めにする
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  // サーバーの起動後、テストの前に 1 回ずつ動かしておく（起動直後の最初の 1 回だけが遅いため。warm-up.ts）
  globalSetup: './warm-up.ts',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    locale: 'ja-JP',
    // 失敗したときだけ、原因調査の材料（操作の記録・スクリーンショット）を残す
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // DB を作り直してから API を起動する（Windows の cmd でも動くよう && でつなぐ）
      command: 'pnpm exec tsx prepare-db.ts && pnpm --filter @xclone/user-server start',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'pipe',
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        USER_SERVER_PORT: String(API_PORT),
        USER_CLIENT_ORIGIN: `http://localhost:${CLIENT_PORT}`,
        PUBLIC_BASE_URL: `http://localhost:${API_PORT}`,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'pnpm --filter @xclone/user-client dev',
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        USER_CLIENT_PORT: String(CLIENT_PORT),
        USER_API_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  ],
})
