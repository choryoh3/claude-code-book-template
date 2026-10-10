---
paths: ['**/server/**/*.ts']
---

# Express サーバー規約

## 層構造（依存は上から下の一方向）

```
routes/       URL とミドルウェアの対応づけのみ
controllers/  req を検証して service を呼び、res を返す（ビジネスロジックを書かない）
services/     ビジネスロジック。Express の型に依存しない
repositories/ Prisma アクセス（複雑なクエリのみ。単純なら service から直接でも可）
middlewares/  認証・RBAC・エラー処理
```

## 規約

- Express 5 は async ハンドラの例外を自動でエラーハンドラへ渡す。`try/catch` + `next(e)` は不要
- 入力は必ず `packages/shared` の Zod スキーマで検証する（body / query / params）
- エラーは `AppError` 系（`NotFoundError` 等）を throw し、エラーミドルウェアで HTTP に変換する
- レスポンスは shared の DTO 型。Prisma のモデルをそのまま返さない（passwordHash 流出防止）
- 他アプリのサーバー（admin ↔ user）を HTTP で呼ばない

```ts
// Good
export const createPost = async (req: Request, res: Response) => {
  const input = createPostSchema.parse(req.body)
  const post = await postService.create(req.user.id, input)
  res.status(201).json(toPostDto(post))
}

// Bad: controller に Prisma と分岐ロジックが混在
```

## DB アクセス

- 一覧取得で N+1 を作らない（`include` / `select` で必要な関連を取得）
- 複数テーブル更新は `prisma.$transaction`
- 一覧は必ずページネーション（cursor 方式）

## ログ・設定

- 環境変数は起動時に Zod で検証した設定オブジェクトから読む（`process.env` の散在禁止）
- パスワード・トークンをログに出さない
