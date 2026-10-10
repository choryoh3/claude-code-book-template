---
paths: ['packages/db/**']
---

# DB 規約（PostgreSQL + Kysely + SQL マイグレーション）

SQL を主役にする。性能が必要な箇所は、発行される SQL を自分で設計して読める形にする。

## 構成

```
packages/db/
├── migrations/        # 素の SQL（node-pg-migrate）。適用済みは編集禁止（hook でブロック）
├── src/
│   ├── index.ts       # Kysely インスタンス（シングルトン）
│   ├── generated/     # kysely-codegen が作る型（手で編集しない・コミットする）
│   └── queries/       # 複雑・再利用するクエリ（機能ごとに 1 ファイル）
└── seed.ts            # 動作確認用テストデータ（docs/test-data.md と一致させる）
```

## スキーマ規約

- テーブルは snake_case 複数形（`posts`）、主キーは `id uuid`（`gen_random_uuid()`）、全テーブルに `created_at` / `updated_at`（`timestamptz`）
- 外部キー制約を必ず付ける。外部キーと、検索・並び替えに使うカラムには `CREATE INDEX` を付ける（理由をコメントに）
- 状態は `CREATE TYPE ... AS ENUM` か `CHECK` 制約で縛る。多対多は中間テーブル（複合主キー）

## クエリ規約

- 値は必ずパラメータ化（Kysely のビルダーか `sql` テンプレート）。文字列連結で SQL を作らない
- N+1 禁止: 一覧は JOIN か `IN (...)` でまとめて取得する。ループ内クエリを書かない
- 一覧は cursor ページネーション（`WHERE (created_at, id) < ($1, $2) ORDER BY ... LIMIT`）
- 複数テーブルの更新は `db.transaction().execute(...)`
- 重いクエリは `EXPLAIN ANALYZE` で確認し、結果の要点をコメントに残す

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

詳細は skill `db-migration`。マイグレーション追加 → `pnpm db:migrate` → `pnpm db:codegen` → seed 更新。
