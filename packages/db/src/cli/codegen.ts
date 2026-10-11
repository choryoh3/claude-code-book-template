// `pnpm db:codegen` の本体。実際の DB の構造から、Kysely 用の TypeScript の型を生成する。
// 出力先: src/generated/db.ts（自動生成なので手で編集しない。マイグレーションのたびに作り直す）
//
// 生成の設定は packages/db/.kysely-codegenrc.json にある。
// - テーブル名・カラム名は DB と同じ snake_case のまま（camelCase に変換しない）。
//   SQL とコードを 1 対 1 で対応させ、クエリを読みやすく・チューニングしやすくするため（docs/adr/0003）
// - date 型の列は、実行時に 'YYYY-MM-DD' の文字列で返るため、型も string に上書きしている（src/index.ts 参照）

import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { getDatabaseUrl } from '../config'

const result = spawnSync('pnpm', ['exec', 'kysely-codegen'], {
  stdio: 'inherit',
  shell: true,
  // 接続文字列は環境変数で渡す（コマンドラインに出してパスワードが見えるのを避ける）
  env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
})

process.exit(result.status ?? 1)
