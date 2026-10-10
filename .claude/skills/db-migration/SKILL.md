---
name: db-migration
description: データベースのスキーマ変更（SQL マイグレーションの追加）と Kysely 型の再生成、seed 更新、影響範囲チェックの手順。「テーブルを追加」「カラムを変更」「インデックスを足す」「スキーマを変える」「マイグレーションを作る」「クエリを高速化」といった依頼で使う。
---

# DB マイグレーション手順（SQL + node-pg-migrate + Kysely）

適用済みのマイグレーションは **絶対に編集しない**（hook でブロックされる）。修正は新しいマイグレーションで行う。

## 手順

1. **影響を考える**: 既存データへの影響（NOT NULL 追加・型変更・削除）を整理する。大きな変更は `db-architect` エージェントに分析させる
2. **マイグレーションを作る**: `pnpm --filter @xclone/db exec node-pg-migrate create <english-snake-name> --migration-file-language sql`
   - 生成された SQL ファイルの `-- Up Migration` に変更、`-- Down Migration` に取り消しを書く
   - 何のための変更か、インデックスを付ける理由をコメントで書く
3. `pnpm db:migrate` で適用する
4. `pnpm db:codegen` で実 DB から `src/generated/` の型を再生成する（これを忘れると型エラーになる）
5. **影響範囲チェック**: 変更したテーブル・カラム名を Grep し、以下を更新する
   - `packages/shared` の Zod スキーマ・DTO
   - `user/server` / `admin/server` の `queries/`・service・mapper
   - `packages/db/seed.ts` と `docs/test-data.md`
6. `pnpm typecheck && pnpm test` で破綻が無いか確認する
7. 設計判断が絡む場合は `/adr` で記録する

## 性能改善のヒント

- 遅いクエリは `EXPLAIN (ANALYZE, BUFFERS)` で確認する。Seq Scan が出ていれば、条件・ソート列にインデックスを検討
- 複合条件の並び順は、インデックスの列順と一致させる（例 `(author_id, created_at DESC)`）
- カウント（いいね数など）は、必要ならカウンタ列や集計テーブルに分離する。変更時は ADR に理由を残す
- 大きなテーブルへの `CREATE INDEX` は `CONCURRENTLY`（トランザクション外）を検討する

## 注意

- NOT NULL カラムを既存テーブルに足すときは `DEFAULT` を付けるか、段階的に（NULL 可 → 埋める → NOT NULL）行う
- 開発 DB を作り直したいときは `/db-reset`（ユーザー確認つき）を使う
