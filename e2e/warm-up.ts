// テストの前の「慣らし運転」。API と画面の開発サーバーは、起動直後の最初の 1 回だけがとても遅い
// （DB への接続の確立・Vite による画面のファイルの初回変換など）。実測で、最初の登録に 13 秒かかり、
// テストの待ち時間を超えて失敗した（docs/troubleshooting.md）。そこで、テストの前に 1 回ずつ動かしておく。

import type { FullConfig } from '@playwright/test'
import { chromium } from '@playwright/test'

export default async function warmUp(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) return

  // 1) API: DB への接続を確立させる（ログイン不要の API を 1 回呼ぶ。応答するまで待つ）
  await waitUntilOk(`${baseURL}/api/users/availability?handle=warmup`, 180_000)

  // 2) 画面: 主な画面を一度開き、Vite に必要なファイルを変換させておく
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    for (const path of ['/signup', '/login']) {
      await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle', timeout: 120_000 })
    }
  } finally {
    await browser.close()
  }
}

/** URL が 200 番台を返すまで、2 秒おきに問い合わせる（起動中のサーバーを待つ） */
async function waitUntilOk(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // まだ起動していない。少し待って再試行する
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`${url} が ${timeoutMs / 1000} 秒以内に応答しませんでした`)
}
