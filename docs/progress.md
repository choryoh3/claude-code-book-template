# 開発の進捗記録

**新しいものを上に追記** します。後継者（人間でも AI でも）は、まずここの先頭と `docs/roadmap.md` を読めば、現在地と次の一手がわかります。

記録の書き方:

```markdown
## YYYY-MM-DD <タスクID> <タイトル>

- やったこと:
- 判断とその理由:
- 次の一手:
- 既知の課題・注意点:
```

---

## 2026-10-11 Phase 0 運用基盤の構築

- やったこと:
  - CLAUDE.md、rules（9 本）、skills（7 本）、commands（10 本）、agents（6 本）、hooks（7 本 + 共通 lib）、MCP、VS Code 設定を整備した
  - hooks に「作業完了時のチーン音」（`notify-sound.mjs`）を追加し、全 hooks の動作テストを行った
  - docs（ロードマップ・テストデータ仕様・トラブルシュート・ADR 7 本）と README（全体像の図・起動手順・VS Code 設定の理由・総括・後継者ガイド）を整備した
  - 画面仕様書（Excel・21 画面・27 シート）の生成基盤を作った（`pnpm spec:screens`、`/screen-spec`）。キャプチャ画像の自動貼り付けは動作確認済み
  - ルートの設定（pnpm workspace、tsconfig、Prettier、ESLint、EditorConfig、husky、docker-compose）を作成した
- 判断とその理由:
  - DB は **Prisma ではなく Kysely + SQL マイグレーション**にした（性能改善のため SQL を直接制御したい要望。→ ADR 0003）
  - ツールのバージョンは **TypeScript 5.9 / ESLint 9 / @antfu/eslint-config 7.7** に固定した（→ ADR 0007、トラブルシュート参照）
  - ログは pino の JSON Lines を `logs/` に出し、`requestId` で追えるようにした（AI が不具合を調査しやすくするため）
- 次の一手: Phase 1（`packages/db` のマイグレーションと seed）。着手前にユーザーの承認を得る
- 既知の課題・注意点:
  - 画面はまだ無いため、画面仕様書（Excel）のキャプチャは UI 完成後（P7-3）に取り込む
  - `.mjs` で ESLint の `unused-imports/no-unused-vars` が誤検知するため無効化している（`docs/troubleshooting.md`）
  - 画面・API・DB は未実装。hooks の `typecheck` は `typecheck` スクリプトが整うまで自動でスキップされる
