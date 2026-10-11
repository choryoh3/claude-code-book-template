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

## 2026-10-12 Phase 3（P3-1〜P3-10）user/server（一般ユーザー向け API）

- やったこと:
  - `user/server`（Express 5 + Kysely の SQL + Socket.IO）: 認証（登録・ログイン・refresh のローテーションと盗用の検知・ログアウト）、プロフィール・フォロー、投稿（リプライ・引用・ハッシュタグ・メンション・削除）、いいね・リポスト・ブックマーク、タイムライン（フォロー中・おすすめ）、通知（一覧・未読・既読・リアルタイム配信）、検索・トレンド、通報、画像のアップロード（中身の検査つき）
  - 土台: 設定の Zod 検証、pino の構造化ログ（requestId・userId つき、秘密値の伏せ字）、共通のエラー応答、DAU の記録、回数制限
  - API 一覧 `docs/api/user.md`、`user/server/README.md`
  - CI（XClone Arcade）のチェックに PostgreSQL のサービスを追加（API テストを GitHub 上でも実行するため）
  - DB: トレンド用のインデックスを追加（マイグレーション 1 本）。shared: 画像 URL の制限・アップロード・通報の応答のスキーマ、パスワードのバイト数の確認
- コードレビュー（code-reviewer エージェント）: **重大 2 件**を修正し、回帰テストを追加
  1. ack なしの Socket.IO イベント 1 回でサーバー全体が止まる → ack の確認と、例外を外に出さない作り、`unhandledRejection` の安全網
  2. 画像 URL に外部 URL・`javascript:` を保存できる（トラッキング・XSS）→ 「このサーバーにアップロードした画像」だけを許す（shared で形、サーバーでホスト名を確認）
  - 改善推奨も修正: 壊れた cursor・大きすぎる本文が 500 になる、複数タブの同時 refresh で全端末がログアウトされる、凍結ユーザーの中身が API で見える、通知の配信の N+1、ハッシュタグ登録のロック、登録のトランザクション、おすすめの順位のずれ、トレンドのインデックス、通知の連打、アップロードの回数制限、パスワードの 72 バイト
- 確認したこと（実行して確認済み）:
  - API テスト **7 ファイル・77 件すべて合格**（本物の PostgreSQL。Socket.IO は実際にサーバーを起動して接続）。shared のテスト 38 件合格
  - `pnpm typecheck`（db / shared / ui / user-server）・ESLint・Prettier がすべて通る
  - テストが本物のバグを見つけた: トランザクション内で例外を投げて「失効」がロールバックされていた（`docs/troubleshooting.md`）
- 判断とその理由:
  - 一覧は「ID の並びを決めるクエリ」と「ID → 画面用の DTO を 1 回の SQL で作る hydratePosts」の 2 段階（N+1 を構造的に防ぐ）
  - cursor の時刻は DB の文字列のまま（JavaScript の Date にするとマイクロ秒が落ち、行を読み飛ばすため）
  - 通知は「操作と同じトランザクションで保存 → コミット後に配信」（配信に失敗しても一覧で取り戻せる）
  - refresh token の同時使用の猶予 10 秒（ADR 0004 に追記）
- 次の一手: Phase 4（user/client）は別の worktree で作業中。完了したら統合し、実際の API と繋いで確認 → P4-8（E2E）。その後 Phase 5（admin/server）
- 既知の課題・注意点:
  - `docs/roadmap.md` の「Phase 3 で見つかった、後の Phase で対応すること」（凍結時の Socket.IO の切断、EXIF の削除、DAU の日付の基準など）
  - `.env.example` が AI の読み取り拒否の設定に巻き込まれて読めない（中身の更新は人の判断待ち。`docs/troubleshooting.md`）
  - API テストは 1 回 10 分前後かかる（この PC で別の作業と並行しているため。単独なら短くなる）

## 2026-10-11 Phase 2（P2-1〜P2-4）shared と ui ／ GitHub Actions の作り替え

- やったこと:
  - `packages/shared`: 定数・日本語メッセージ・エラーコード・Zod スキーマ（認証・ユーザー・投稿・通知・通報・検索・管理）・DTO 型・Socket.IO のイベント型・本文解析（ハッシュタグ・メンション）。テスト 35 件
  - `packages/ui`: `cn()`・Button（バリアント・処理中）・Avatar（頭文字の代替表示）・Dialog（Radix Vue）。テスト 22 件。Tailwind を実際にビルドし、トークンと部品のクラスが生成されることを確認
  - `packages/db/src/contract.ts`: DB の列挙型と shared の定数の一致を型で保証（わざと食い違わせて検出できることを確認）。seed も shared の定数・関数を使うよう変更（seed の結果は完全に同一であることを確認）
  - GitHub Actions（`hello.yml`）を「🎮 XClone Arcade」に作り替え: 本物のチェック（整形・lint・型・テスト）に、おみくじ・リポジトリのレベル・花火/スロットのフィナーレを追加（Summary に Mermaid の円グラフも出す）
- 判断とその理由（詳細は ADR 0008）:
  - shared / ui は **ビルドせず TypeScript のソースを直接共有**（アプリの Vite / tsx がそのまま読める）
  - `lucide-vue-next` は npm 上で非推奨のため **`@lucide/vue`** を採用。`radix-vue` は指定どおり（後継の `reka-ui` への移行条件を ADR に記録）
  - 管理画面の一覧は **ページ番号方式**、ユーザー向けは **cursor 方式**（用途が違うため）
- 確認したこと: `pnpm check`（型・lint・テスト）、Prettier、ワークフローの YAML と bash の構文・各ステップのローカル実行（Actions 自体は GitHub 上での実行が必要）
- 次の一手: Phase 3（`user/server`）。着手前にユーザーの承認を得る。Phase 3 から DB を使うテストが増えるので、CI に PostgreSQL サービスを足す
- 既知の課題・注意点:
  - Actions の実際の動作は、push して GitHub 上で確認する（ローカルでは構文と各ステップの実行までしか確認できない）
  - ESLint の自動修正（保存時）は「まだ使っていない import」を消す。import を足すときは、**使うコードを先に書いてから**足す（`docs/troubleshooting.md`）

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
