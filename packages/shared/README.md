# @xclone/shared — API 契約

画面（client）とサーバー（server）が共有する **約束事の唯一の置き場** です。ここを変えると、使っている全アプリに影響します（変更後は `pnpm check`）。

```
packages/shared/src/
├── index.ts          # 入口（アプリは必ずここから import する）
├── constants.ts      # 文字数の上限・列挙の値・トークンの有効期間などの定数
├── messages.ts       # 入力チェックの日本語メッセージ（画面にそのまま表示される）
├── errors.ts         # エラーコードと、エラー応答の形 { error: { code, message, requestId } }
├── text.ts           # 本文の解析: extractHashtags / extractMentions
├── socket.ts         # Socket.IO のイベント名と型（server / client が同じ型を使う）
└── schemas/          # Zod スキーマ（入力の検証）と、そこから作る型（DTO）
    ├── common.ts     #   ID・日時・ページネーション（cursor 方式 / page 方式）
    ├── user.ts       #   登録・ログイン・プロフィール
    ├── post.ts       #   投稿の作成・表示・一覧
    ├── notification.ts / report.ts / search.ts
    └── admin.ts      #   管理者: ユーザー・投稿・通報・監査ログ・統計
```

## 使い方

```ts
import { createPostSchema, MAX_POST_LENGTH } from '@xclone/shared'
import type { CreatePostInput, PostDto } from '@xclone/shared'

// 入力の検証（server は req.body、client はフォームの値に対して）
const result = createPostSchema.safeParse({ content: '今日の #開発日記' })
if (!result.success) console.log(result.error.issues[0]?.message) // 日本語のメッセージ

// 型はスキーマから作られる（手書きしない）
function render(post: PostDto) {}
```

## 命名規則

| 種類            | 名前                                  | 例                 |
| --------------- | ------------------------------------- | ------------------ |
| スキーマ        | `xxxSchema`                           | `createPostSchema` |
| 入力の型        | `XxxInput`                            | `CreatePostInput`  |
| 応答の型（DTO） | `XxxDto`（スキーマは `xxxDtoSchema`） | `PostDto`          |

## 守ること

- **型は必ず `z.infer` で作る**。手書きの interface と二重管理しない
- 実行環境に依存するもの（Prisma・Express・Vue など）を import しない（純粋に保つ）
- DB の列挙型を変えたら、`constants.ts` も同じ値にする。食い違うと `pnpm typecheck` が失敗する（`packages/db/src/contract.ts`）
- 規約: `.claude/rules/shared-contracts.md` ／ 設計の理由: [ADR 0008](../../docs/adr/0008-shared-and-ui-package-choices.md)
