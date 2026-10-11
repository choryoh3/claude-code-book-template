---
paths: ['**/server/**/*.ts']
---

# Express サーバー規約

## 層構造（依存は上から下の一方向。見本は user/server）

```
routes.ts     URL と controller の対応表のみ
controllers/  入力を Zod で検証 → service を呼ぶ → 応答（ビジネスロジックを書かない）
services/     ビジネスロジック。Express に依存しない。DB は Kysely（複雑な一覧は sql テンプレート）
queries/      複数の service で使うクエリ（例: hydratePosts = ID の一覧 → DTO を SQL 1 回で）
mappers.ts    DB の行（snake_case）→ DTO（camelCase）。DB の行をそのまま返さない
middlewares/  認証・活動記録・requestId・エラー変換
```

## 規約

- Express 5 は async の例外を自動でエラーハンドラへ渡す。`try/catch` + `next(e)` は不要
- 入力は必ず `packages/shared` の Zod スキーマで検証する（body / query / params）
- エラーは `errors.ts` の `badRequest` / `notFound` などを throw する。応答の形は `{ error: { code, message, requestId } }`
- 他アプリのサーバー（admin ↔ user）を HTTP で呼ばない。設定は `config.ts`（Zod で検証）から読む

```ts
// Good: controller は「検証 → service → 応答」だけ
async create(req: Request, res: Response) {
  const input = createPostSchema.parse(req.body)
  res.status(201).json(await postService.createPost(deps, getAuth(req).userId, input))
}
```

## DB・落とし穴

- 一覧は cursor（`(created_at, id) < (...)`）。cursor の時刻は `created_at::text` のまま渡す（Date にすると精度が落ちて行を飛ばす）
- 複数テーブルの更新は `db.transaction()`。**トランザクションの中で例外を投げると、中の変更（失効の記録など）も消える**。残したい処理は外で行う
- 通知は「操作と同じトランザクションで保存 → コミット後に配信」
- 画面から届くデータ（Socket.IO の ack を含む）は型どおりとは限らない。async の処理の失敗を外に漏らさない（プロセスが止まる）
- 外部の URL を保存させない（画像は `lib/media-url.ts`）。値は必ずパラメータ化し、`sql.raw` は固定値だけ
