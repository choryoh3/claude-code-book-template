---
description: ブランチを push して gh CLI で Pull Request を作成する（本文テンプレート付き）
disable-model-invocation: true
---

現在のブランチから Pull Request を作成してください。

1. `git status` / `git log main..HEAD --oneline` / `git diff main...HEAD --stat` で変更内容を把握する
2. `main` 上にいる場合は、変更内容に合わせたブランチ名（例 `feat/user-bookmarks`）を作って切り替える
3. `pnpm typecheck && pnpm lint && pnpm test` が通ることを確認する（失敗していたら報告して中止）
4. `git push -u origin <branch>`（**force push はしない**）
5. `gh pr create` で PR を作る。タイトルは Conventional Commits 形式。本文は `.github/PULL_REQUEST_TEMPLATE.md` に沿って、
   概要・変更点・テスト方法・スクリーンショット（UI 変更時）・関連 ADR を埋める
6. 作成した PR の URL を報告する
