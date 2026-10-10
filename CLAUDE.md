# CLAUDE.md

X（旧Twitter）クローン SNS。管理者アプリと一般ユーザーアプリを物理分離し、同一 PostgreSQL を共有する pnpm モノレポ。
全体像・使い方・開発手順は `README.md`、現在地と次の一手は `docs/progress.md` と `docs/roadmap.md`。

## 構成

```
admin/{client,server}   管理画面 Vue3 (5174) / 管理API Express5 (3001)
user/{client,server}    ユーザー画面 Vue3 (5173) / ユーザーAPI Express5 (3000)
packages/db             SQL マイグレーション・Kysely・seed
packages/shared         Zod スキーマ・型・定数・API 契約
packages/ui             tokens.css・Tailwind 設定・共通コンポーネント
docs/                   adr・api・roadmap・progress・test-data・troubleshooting
.claude/                rules(条件付き) skills(自動) commands(手動) agents hooks
```

技術: Vue 3 + Pinia + Vite / Express 5 + TypeScript / Zod / PostgreSQL + Kysely(SQL) / Socket.IO / Tailwind v4 / Vitest + Playwright。

## コマンド

```powershell
pnpm dev          # 全アプリ起動
pnpm check        # typecheck + lint + test（コミット前に必ず）
pnpm db:migrate   # SQL マイグレーションを適用
pnpm db:codegen   # 実 DB から Kysely の型を再生成
pnpm db:seed      # テストデータ投入（db:reset は /db-reset 経由のみ）
pnpm logs:errors  # 直近のエラーログ / logs:trace <requestId> で 1 リクエストを追跡
```

## 絶対ルール

- `packages/shared` の Zod スキーマを唯一の真実とする。型は `z.infer` で導出し、二重定義しない
- admin と user のサーバーは互いの API を呼ばない。共有したい処理は `packages/*` へ
- DB 変更は SQL マイグレーション経由。適用済みは編集しない。生成された型（`generated/`）は手で直さない
- 秘密情報は `.env` のみ。コミットしない（例は `.env.example`）
- 読みやすさ最優先: 1 関数 1 責務、わかりやすい命名と日本語コメント、`any` 禁止（`.claude/rules/code-quality.md`）
- 管理者操作は必ず監査ログに記録し、RBAC を通す
- 機能を足したら seed と `docs/test-data.md` を更新する（動作確認用データを常に最新に）
- Conventional Commits（`feat(user-client): ...`）。設計判断は `docs/adr/` に記録

## 自走と引き継ぎ

- 次の作業は `/next`（roadmap の未完了タスクを自走で進める）。人の承認が要るのは設計の大きな分岐・不可逆操作・Phase 完了のみ
- 作業のたびに `docs/progress.md` に「やったこと・判断・次の一手」を追記し、`docs/roadmap.md` を更新する
- 不具合は `/debug`（skill `debugging`、agent `bug-investigator`）。ログは `logs/*.log`（JSON Lines、`requestId` で追える）
- 詰まった落とし穴は `docs/troubleshooting.md` に追記する

## 参照先

- 領域別の規約: `.claude/rules/`（編集時に自動で読み込まれる）
- 手順書・UI 仕様: `.claude/skills/`
- 定型ワークフロー: `/next` `/feature` `/debug` `/review` `/test` `/db-reset` `/api-doc` `/adr` `/pr` `/screen-spec`
- CLAUDE.md に追記したくなったら、まず rules / skills / docs に置けないか検討する

## 環境

- Windows 11 / PowerShell 5.1（`&&` `||` 不可）。Node 22、pnpm 10（`npm i -g pnpm@10`）
- 環境変数は `.env.example` を `.env` にコピー。GitHub MCP は `GITHUB_PERSONAL_ACCESS_TOKEN` を環境変数で設定
- hooks は Node.js（`.claude/hooks/*.mjs`）。保存時に prettier + eslint、完了時に型チェックと完了音
