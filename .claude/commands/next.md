---
description: docs/roadmap.md から次の未完了タスクを選び、計画→実装→検証→記録まで自走で進める
argument-hint: [タスクID または 空欄で自動選択]
---

開発を前に進めてください。対象: $ARGUMENTS（空欄なら `docs/roadmap.md` の最初の未完了タスク）

## 自走のルール

- **人の承認が必要なのは「設計の大きな分岐」「不可逆な操作」「Phase の完了」だけ**。それ以外は自分で判断して進める
- 迷ったら、`docs/adr/` と `.claude/rules/` の既存方針に合わせる。新しい方針は ADR に残す
- 各ステップで検証し、失敗したら原因を調べて直す（`bug-investigator` / skill `debugging`）。握りつぶさない

## 手順

1. `docs/roadmap.md` と `docs/progress.md` を読み、現在地と次のタスクを確認する
2. タスクの受け入れ条件（Definition of Done）を確認する。曖昧なら最小限の質問をする
3. `/feature` の手順で実装する（調査は `explorer`、テストは `test-writer`、確認は `ui-verifier`）
4. **品質ゲート**: `pnpm typecheck` / `pnpm lint` / `pnpm test` がすべて通り、`code-reviewer` の「🔴 重大」が 0 件
5. **記録**: `docs/roadmap.md` のチェックを更新し、`docs/progress.md` に「やったこと・判断・次の一手・既知の課題」を追記する
6. Conventional Commits でコミットする
7. 次のタスクが同じ Phase にあり、かつ承認不要なら 1 に戻って続ける。Phase が終わったら報告して止まる
