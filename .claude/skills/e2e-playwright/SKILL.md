---
name: e2e-playwright
description: Playwright による E2E テストの追加手順と Page Object パターン。「E2E テストを書く」「画面の通し動作をテスト」「Playwright」といった依頼で使う。
---

# E2E テスト（Playwright）

## 方針

- E2E は **主要な導線だけ**（登録→投稿→いいね→フォロー→通知、管理者の凍結→ログイン拒否 など）。細かい分岐は単体/API テストで担保する
- セレクタは `getByRole` / `getByLabel` / `data-testid`。CSS クラスに依存しない
- 固定の `waitForTimeout` は使わない。`expect(...).toBeVisible()` などの自動待機に任せる

## 構成

```
e2e/
├── playwright.config.ts   # user(5173)/admin(5174) の webServer と project を定義
├── fixtures/              # 認証済みコンテキストなど共通の前提
├── pages/                 # Page Object（1 画面 1 クラス）
└── tests/                 # *.spec.ts（機能ごと）
```

## Page Object のひな型

```ts
import type { Page } from '@playwright/test'

/** タイムライン画面の操作をまとめたクラス。テスト側にセレクタを書かないための入れ物 */
export class TimelinePage {
  constructor(private readonly page: Page) {}

  async post(text: string) {
    await this.page.getByRole('textbox', { name: '今どうしてる？' }).fill(text)
    await this.page.getByRole('button', { name: 'ポストする' }).click()
  }
}
```

## 手順

1. 必要な Page Object を追加/更新
2. テストは独立させる（毎回ユニークなユーザーを API 経由で作成し、UI 操作は検証したい部分だけに）
3. `pnpm test:e2e` で実行。失敗時は trace / スクリーンショットで原因を確認し、flaky なら待機条件を直す
4. UI の見た目確認は `ui-verifier` エージェント（Playwright MCP）に任せる
