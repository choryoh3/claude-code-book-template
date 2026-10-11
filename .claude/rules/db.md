---
paths: ['packages/db/**']
---

# DB 規約（PostgreSQL + Kysely + SQL マイグレーション）

SQL を主役にする。性能が必要な箇所は、発行される SQL を自分で設計して読める形にする。全テーブルの一覧は `docs/db-schema.md`。

## 構成

```
packages/db/
├── migrations/      # 素の SQL（node-pg-migrate）。適用済みは編集禁止（hook でブロック）
├── src/
│   ├── index.ts     # getDb()（Kysely）・型の export。config.ts は接続設定
│   ├── generated/   # kysely-codegen が作る型（手で編集しない・コミットする）
│   ├── queries/     # 複雑・再利用するクエリ（機能ごとに 1 ファイル）
│   └── cli/         # db:migrate / db:codegen / db:seed / db:reset の本体
├── seed.ts, seed/   # テストデータ（docs/test-data.md と一致させる）
└── .kysely-codegenrc.json  # 型生成の設定（snake_case のまま。date 列は string）
```

## スキーマ規約

- テーブルは snake_case 複数形、主キーは `id uuid`（`gen_random_uuid()`）、`created_at` / `updated_at`（`timestamptz`）
- 外部キー制約を必ず付ける。外部キーと、検索・並び替えに使う列には `CREATE INDEX`（理由をコメントに）
- 状態は `CREATE TYPE ... AS ENUM` か `CHECK` 制約で縛る。多対多は中間テーブル（複合主キー）
- 一意性は DB の制約で守る（アプリの確認だけに頼らない）。大文字小文字を区別しないものは `lower(col)` の一意 index

## クエリ規約

- 値は必ずパラメータ化（Kysely のビルダーか `sql` テンプレート）。文字列連結で SQL を作らない
- N+1 禁止: 一覧は JOIN か `IN (...)` でまとめて取得する。ループ内クエリを書かない
- 一覧は cursor ページネーション（`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT`）
- ハンドル・メールの完全一致は `lower(handle) = lower($1)`（`handle = $1` だと一意 index が使われない）
- 複数テーブルの更新は `db.transaction().execute(...)`。重いクエリは `EXPLAIN (ANALYZE, BUFFERS)` で確認する

```ts
// Good: 1 回の JOIN で投稿と投稿者を取得
const rows = await db
  .selectFrom('posts')
  .innerJoin('users', 'users.id', 'posts.author_id')
  .select(['posts.id', 'posts.content', 'users.handle'])
  .execute()
// Bad: posts を取得してから、1 件ずつ users を取得するループ
```

## 変更手順

skill `db-migration`: マイグレーション追加 → `pnpm db:migrate` → `pnpm db:codegen` → seed と `docs/test-data.md` を更新。
