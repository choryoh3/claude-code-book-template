---
paths: ['packages/shared/**']
---

# shared（API 契約）規約

`packages/shared` は client / server の唯一の真実。ここを変えると全アプリに影響する。

## 構成

```
src/
├── constants.ts   # MAX_POST_LENGTH など共有定数
├── schemas/       # Zod スキーマ（機能ごとに 1 ファイル: post.ts, user.ts ...）
├── types/         # z.infer で導出した型・DTO
├── socket.ts      # Socket.IO イベント名と payload 型
└── index.ts       # 公開 API（ここ経由でのみ import させる）
```

## 規約

- 型は必ずスキーマから導出する。手書きの interface と二重管理しない
- スキーマ名は `xxxSchema`、型名は `Xxx`、DTO は `XxxDto`
- 入力（`CreatePostInput`）と出力（`PostDto`）を分ける
- バリデーションメッセージは日本語。制限値は `constants.ts` を参照する
- Prisma / Express / Vue など実行環境に依存するものを import しない（純粋に保つ）
- 破壊的変更（必須化・型変更）は影響する client / server を同じ変更内で直す

```ts
// Good
export const createPostSchema = z.object({
  content: z.string().min(1).max(MAX_POST_LENGTH),
  mediaUrls: z.array(z.url()).max(MAX_POST_MEDIA),
})
export type CreatePostInput = z.infer<typeof createPostSchema>

// Bad: interface CreatePostInput { content: string } を別に手書き
```
