# @xclone/db — データベース

PostgreSQL への接続（Kysely）、SQL マイグレーション、テストデータ（seed）をまとめたパッケージです。`user/server` と `admin/server` が、ここから同じ DB を使います。

```
packages/db/
├── migrations/             # SQL マイグレーション（6 本・13 テーブル）。適用済みは編集しない
├── src/
│   ├── index.ts            # getDb() / closeDb() / 型の公開（アプリはここだけを import する）
│   ├── config.ts           # 接続先（DATABASE_URL。無ければ開発用の既定値）
│   ├── migrations.ts       # マイグレーションの実行（node-pg-migrate）
│   ├── generated/db.ts     # kysely-codegen が作る型（自動生成。手で編集しない）
│   └── cli/                # db:migrate / db:codegen / db:seed / db:reset の本体
├── seed.ts                 # テストデータの入口
├── seed/                   # テストデータの部品（users / posts / social / notifications / moderation）
└── .kysely-codegenrc.json  # 型生成の設定
```

## コマンド（リポジトリのルートで実行）

| コマンド                                  | 内容                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm db:migrate`                         | 未適用のマイグレーションを全て適用                                          |
| `pnpm db:codegen`                         | 実 DB から `src/generated/db.ts` を再生成（**マイグレーションの後は必ず**） |
| `pnpm db:seed`                            | テストデータを入れ直す（既存データは削除）                                  |
| `pnpm db:reset`                           | 全テーブルを作り直す → マイグレーション → seed（**/db-reset 経由のみ**）    |
| `pnpm --filter "@xclone/db" migrate:down` | 直近 1 件のマイグレーションを取り消す                                       |

## アプリからの使い方

```ts
import { closeDb, getDb } from '@xclone/db'

const db = getDb() // 初回に接続プールを作る。アプリ全体で共有される

// SQL がそのまま読める。列名は DB と同じ snake_case
const posts = await db
  .selectFrom('posts')
  .innerJoin('users', 'users.id', 'posts.author_id')
  .select(['posts.id', 'posts.content', 'users.handle'])
  .where('posts.status', '=', 'visible')
  .orderBy('posts.created_at', 'desc')
  .limit(20)
  .execute()

await closeDb() // サーバーの終了時に呼ぶ
```

## 守ること

- 規約: `.claude/rules/db.md`、スキーマ一覧: [`docs/db-schema.md`](../../docs/db-schema.md)、手順: skill `db-migration`
- 設計判断の理由: [ADR 0003](../../docs/adr/0003-kysely-and-sql-migrations.md)
- seed を変えたら [`docs/test-data.md`](../../docs/test-data.md) も更新する
