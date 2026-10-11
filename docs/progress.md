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

## 2026-10-11 Phase 1（P1-1〜P1-6）DB・マイグレーション・テストデータ

- やったこと:
  - `packages/db`（`@xclone/db`）を作成。Kysely の接続（`getDb()`）、SQL マイグレーション 6 本（13 テーブル）、型の自動生成（kysely-codegen）、CLI（`db:migrate` / `db:codegen` / `db:seed` / `db:reset`）
  - テストデータ（seed）を実装。32 ユーザー・200 投稿・通知 110・通報 12・監査ログ 23 など（内容は `docs/test-data.md`）
  - データ辞書 `docs/db-schema.md`（ER 図・インデックスと使う場面）を作成。DB の規約 `.claude/rules/db.md` を実態に合わせて更新
- 確認したこと（すべて実行して確認済み）:
  - 全マイグレーションの **Down → Up の往復**、`db:reset`（全削除 → 再作成 → seed）
  - 同じ基準日（`SEED_BASE_DATE`）で seed を 2 回実行して **全テーブルのダイジェストが一致**（再現性）
  - 件数・特殊ケース（280 文字ちょうど・凍結ユーザー・空状態のユーザーなど）、時刻の整合性（矛盾 0 件）
  - DB の制約（281 文字・画像 5 枚・大文字小文字違いの重複ハンドルの拒否、監査ログの UPDATE / DELETE 拒否）
  - seed のパスワードが bcrypt で照合できること（alice / dave / admin）
  - 主要 9 クエリが意図したインデックスを使えること（`EXPLAIN`）
- 判断とその理由:
  - 管理者は `users` の `role = 'admin'` として持つ（認証経路だけを分ける。ADR 0004）
  - 監査ログの改ざん防止を **DB のトリガー** でも行う（アプリのバグがあっても UPDATE / DELETE できない）
  - 検索は `pg_trgm`（日本語は単語区切りが無いため全文検索よりトライグラムが扱いやすい）
  - 列名は snake_case のまま（SQL とコードを 1 対 1 に対応させる。ADR 0003）。DTO への変換は server 側で行う
  - seed は更新日時を明示する（既定の `now()` だと実行のたびに値が変わり、再現性が崩れるため）
  - DB は Docker ではなく、この PC の PostgreSQL 17（postgres / test999、DB `xclone`）を使った
- 次の一手: Phase 2（`packages/shared` と `packages/ui`）。着手前にユーザーの承認を得る
- 既知の課題・注意点:
  - `.env` は未作成（無くても開発用の既定値で動く）。作る場合は `Copy-Item .env.example .env`
  - ハンドル・メールの完全一致は `lower(col) = lower($1)` で書くこと（そうしないと一意 index が使われない）
  - 件数が増えたら `EXPLAIN (ANALYZE, BUFFERS)` で再確認する。カウンタ列・パーティション等は `docs/db-schema.md` の「将来の改善候補」
  - 画像の URL は外部サービス（picsum.photos）。オフラインでは表示されない
  - Docker が無い環境のため `docker compose` の動作は未確認

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
