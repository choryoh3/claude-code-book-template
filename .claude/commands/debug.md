---
description: 不具合を調査し、根本原因・修正方針・回帰テストまで進める
argument-hint: <症状・エラーメッセージ・requestId>
---

次の不具合を調査してください: $ARGUMENTS

1. skill `debugging` の手順に従う
2. 調査は `bug-investigator` エージェントに任せる（ログ・DB・コードを突き合わせて根本原因を報告させる）
3. 報告を読み、根拠（ログ行・SQL 結果・コード）が原因と結びついているか自分でも確認する
4. **先に失敗する回帰テストを書き**、根本原因を修正し、テストが通ることを確認する
5. `pnpm typecheck && pnpm lint && pnpm test` を実行する
6. 落とし穴になりそうな原因は `docs/troubleshooting.md` に追記する
7. 症状 / 根本原因 / 修正 / 追加テスト / 再発防止を報告する。コミットは `fix(...)` で行う
