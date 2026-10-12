# e2e/ — E2E テスト（Playwright）

ブラウザを実際に操作して、**画面から API・DB まで通しで動くか** を確認するテストです。
主要な導線だけを対象にします（細かい分岐は API テスト・画面の単体テストで確かめる）。

## 実行

```powershell
pnpm test:e2e                       # または pnpm --filter @xclone/e2e test:e2e
pnpm --filter @xclone/e2e exec playwright show-report   # 結果のレポートをブラウザで見る
```

初回だけ、ブラウザ（Chromium）のダウンロードが必要です: `pnpm --filter @xclone/e2e exec playwright install chromium`

## 仕組み（開発中のデータ・サーバーには触れない）

```
playwright.config.ts
 ├─ prepare-db.ts   E2E 専用の DB（xclone_e2e）を空にして、最新のマイグレーションを適用
 ├─ user/server を 3100 番で起動（DATABASE_URL = xclone_e2e）
 ├─ user/client を 5273 番で起動（API の転送先 = 3100）
 ├─ warm-up.ts      起動直後は遅いので、API と主な画面を 1 回ずつ動かしておく
 └─ tests/*.spec.ts テスト本体
```

- 開発用の DB（xclone）と、開発中に動かしているサーバー（3000 / 5173）は使わないので、並行して動かせます
- DB 名が `_e2e` で終わらないと、作り直しを止めます（誤って他の DB を消さないため）

## 構成

```
e2e/
├── playwright.config.ts
├── prepare-db.ts / warm-up.ts
├── pages/app.ts               # Page Object（SignupPage / HomePage / ProfilePage）
└── tests/user-journey.spec.ts # 登録 → 投稿 → フォロー・いいね → 通知のリアルタイム受信 / ログアウトと再ログイン
```

## 書き方

- 画面の要素は、利用者に見える名前で探す（`getByRole` / `getByLabel`）。CSS のクラスに依存しない
- セレクタはテストに書かず、`pages/` の Page Object に集める
- 固定の待ち時間（`waitForTimeout`）は使わない。`expect(...).toBeVisible()` の自動待機に任せる
- 毎回別のアカウントを作る（`newAccount()`）。テスト同士でデータを共有しない
- 失敗したら `test-results/` のスクリーンショットと trace を見る（`docs/troubleshooting.md`）
- 詳しくは skill `e2e-playwright`、規約は `.claude/rules/testing.md`、使えるテストデータは `docs/test-data.md`
