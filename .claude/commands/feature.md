---
description: 機能を「計画→実装→テスト→lint→ドキュメント/テストデータ更新→コミット」まで一連で進める
argument-hint: <実装したい機能の説明>
---

次の機能を実装してください: $ARGUMENTS

以下の手順を **順番に** 実行します。

## 1. 調査と計画

- `explorer` エージェントで関連する既存コードを調べる（メインの文脈を汚さないため）
- 影響範囲（shared / db / server / client）と実装方針を **短い計画として提示** し、ユーザーの承認を得る
- 設計判断（ライブラリ選定・データモデル・認証方式など）が絡むなら、実装前に `/adr` で記録する

## 2. 実装（外側から内側へ）

- DB 変更があれば skill `db-migration`、API なら `api-endpoint`、画面なら `vue-feature`、リアルタイムなら `realtime-socket`
- `.claude/rules/` の規約（特に `code-quality.md`）に従い、**わかりやすい日本語コメント**を付ける
- テストが書ける粒度なら `test-writer` エージェントに依頼する

## 3. 確認

- `pnpm typecheck` → `pnpm lint` → `pnpm test` を実行し、失敗は原因を直す（握りつぶさない）
- UI を変えた場合は `ui-verifier` エージェントで画面を確認する
- `code-reviewer` エージェントで差分をレビューし、指摘を反映する

## 4. 継続開発のための後始末（必須）

- **テストデータ**: 新しいモデル/機能があれば `packages/db/seed.ts` に動作確認用データを追加する（`docs/test-data.md` も更新）
- **ドキュメント**: API を変えたら `/api-doc`。`docs/roadmap.md` の該当項目を完了にし、見つかった課題・次の改善案を追記する
- CLAUDE.md への追記が必要か検討する（先に rules / skills / docs に置けないか考える）

## 5. コミット

Conventional Commits（例 `feat(user-server): add bookmark endpoints`）で、論理的なまとまりごとにコミットする。
