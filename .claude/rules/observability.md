---
paths: ['**/server/**/*.ts', 'packages/db/**/*.ts']
---

# ログ・エラー規約（AI が調査しやすくするため）

不具合が起きたとき、**ログだけで「いつ・誰が・何をして・どこで失敗したか」が追える**ことを目標にする。

## ログ

- `pino` を使い、**1 行 1 JSON** で `logs/<app>.log`（開発時は標準出力にも）へ出力する。`console.log` は使わない
- 全リクエストに `requestId`（UUID）を付与し、すべてのログ行に含める（AsyncLocalStorage で伝播）
- リクエスト完了ログに `method` `path` `status` `durationMs` `userId`（あれば）を出す
- レベル: `error`（想定外の失敗）/ `warn`（想定内の失敗: 401, 検証エラー）/ `info`（主要な業務イベント）/ `debug`
- **出してはいけない**: パスワード・トークン・Cookie・メール全文。`redact` で自動マスクする

```ts
// Good: 構造化ログ。検索しやすい
logger.info({ requestId, userId, postId }, 'post.created')
// Bad: 文字列連結。検索・集計しづらい
console.log('user ' + userId + ' created post ' + postId)
```

## エラー

- `AppError`（`code` / `httpStatus` / `message`）を継承して投げる。`code` は `POST_NOT_FOUND` のような安定した識別子
- エラー応答は `{ error: { code, message, requestId } }`。利用者が問い合わせる際に `requestId` を伝えられる
- 想定外の例外は握りつぶさず、スタックトレースつきで `error` ログに出してから 500 を返す
- `catch` で何もしない・ログだけして続行、は禁止（理由があればコメントで明記）

## 調査用コマンド

`pnpm logs:errors`（直近のエラー行）、`pnpm logs:trace <requestId>`（1 リクエストの全行）。
詳細な調査手順は skill `debugging` を参照。
