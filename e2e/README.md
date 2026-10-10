# e2e/ — E2E テスト（Playwright）

ブラウザを実際に操作して、**画面から API・DB まで通しで動くか** を確認するテストです。
主要な導線だけを対象にします（登録→投稿→いいね→フォロー→通知、管理者の凍結→ログイン拒否 など）。

- 書き方と構成: skill `e2e-playwright`、規約: `.claude/rules/testing.md`
- 使うアカウントとデータ: `docs/test-data.md`
- 実装は Phase 4 と Phase 6 です
