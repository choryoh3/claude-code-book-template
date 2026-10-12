# ロードマップ

AI が自走で開発を進めるための **タスク台帳** です。`/next` コマンドは、ここの最初の未完了タスク（`[ ]`）を選んで実装します。
完了したら `[x]` に変え、`docs/progress.md` に記録します。

- 各タスクの **完了条件（DoD）** は「品質ゲート」に加えて、タスクごとの受け入れ条件です
- 人の承認が必要なのは「設計の大きな分岐」「不可逆な操作」「Phase の完了」だけです

## 品質ゲート（全タスク共通の DoD）

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` がすべて通る
- [ ] `code-reviewer` の「🔴 重大」が 0 件
- [ ] 新しいテーブル・機能があれば、seed（`packages/db/seed.ts`）と `docs/test-data.md` を更新した
- [ ] API を変えたら `/api-doc` で `docs/api/` を更新した
- [ ] 設計判断があれば `docs/adr/` に記録した
- [ ] わかりやすい日本語コメント（ファイルの役割・公開関数・「なぜ」）を付けた

## Phase 0: 運用基盤 ✅

- [x] P0-1 CLAUDE.md（100 行以内）
- [x] P0-2 `.claude/rules/`（領域別の規約）
- [x] P0-3 `.claude/skills/`（手順書）
- [x] P0-4 `.claude/commands/`（`/feature` `/next` `/debug` ほか）
- [x] P0-5 `.claude/agents/`（レビュー・テスト・DB・UI・調査）
- [x] P0-6 hooks（整形・ガード・型チェック・完了音）
- [x] P0-7 `.mcp.json`（postgres / playwright / context7 / github）
- [x] P0-8 VS Code 設定・各種設定ファイル
- [x] P0-9 docs（ADR・ロードマップ・テストデータ仕様・トラブルシュート）・README

## Phase 1: モノレポ骨格と DB ✅

受け入れ条件: `pnpm db:migrate && pnpm db:seed` が成功し、SQL クライアントで中身を確認できる。

- [x] P1-1 `packages/db` の package.json、Kysely 接続（`src/index.ts`）、node-pg-migrate、kysely-codegen の設定
- [x] P1-2 マイグレーション 6 本（13 テーブル）: users / refresh_tokens / posts / hashtags / post_hashtags / follows / likes / reposts / bookmarks / notifications / reports / audit_logs / daily_active_users。Down も往復テスト済み
- [x] P1-3 インデックス設計（タイムライン・通知・検索・集計）と `EXPLAIN` での確認（`docs/db-schema.md`）
- [x] P1-4 `pnpm db:codegen` で型を生成しコミット
- [x] P1-5 `seed.ts`（`docs/test-data.md` の仕様どおり。同じ基準日なら 2 回の実行結果が完全に一致することを確認）
- [x] P1-6 `pnpm db:reset`（リセット + seed）と docs の更新

## Phase 2: shared と ui ✅

受け入れ条件: `pnpm typecheck` が通る。

- [x] P2-1 `packages/shared`: 定数・Zod スキーマ・DTO 型・Socket.IO イベント型・エラー定義・本文解析。テスト 35 件
- [x] P2-2 `packages/ui`: tokens.css・Tailwind のビルド確認・`cn()` / `cva()`
- [x] P2-3 共通コンポーネント: Button / Avatar / Dialog（Radix Vue）。テスト 22 件
- [x] P2-4 DB の列挙型と shared の定数の一致を型で保証（`packages/db/src/contract.ts`）

## Phase 3: user/server ✅

受け入れ条件: Supertest で主要エンドポイントが通り、`docs/api/user.md` がある。

- [x] P3-1 土台: Express 5、設定の Zod 検証、pino ログ + requestId、エラーミドルウェア（`AppError`）
- [x] P3-2 認証: 登録・ログイン・ログアウト・リフレッシュ（JWT + httpOnly Cookie + bcrypt、ローテーションと盗用の検知）
- [x] P3-3 投稿: 作成・削除・詳細・リプライ・引用・画像添付（最大 4 枚、`POST /media`）
- [x] P3-4 フォロー、いいね・リポスト・ブックマーク
- [x] P3-5 タイムライン: フォロー中（時系列）/ おすすめ（簡易スコアリング）、cursor ページネーション
- [x] P3-6 通知: 生成 + Socket.IO リアルタイム配信
- [x] P3-7 検索: 投稿・ユーザー・ハッシュタグ・トレンド
- [x] P3-8 通報の受付
- [x] P3-9 `docs/api/user.md`（API 一覧）
- [x] P3-10 コードレビューの指摘（重大 2 件・改善推奨）の修正と回帰テスト、CI に PostgreSQL を追加

### Phase 3 で見つかった、後の Phase で対応すること

- [ ] 管理者が凍結したとき、接続中の Socket.IO を切断する（Phase 5。今は次の操作のたびに凍結を確認している）
- [ ] 画像の EXIF（撮影位置など）の削除、どの投稿にも使われない画像の掃除（バックログ）
- [ ] DAU の「日付」の基準（今は UTC）を、ダッシュボードの表示（日本時間）に合わせるか決める（Phase 5 の統計 API で ADR）
- [ ] 存在しない `/api/...` が 401 になる（ログイン必須のルートの前で 404 にする。軽微）
- [ ] `NODE_ENV` を付け忘れると開発モードで動く（本番のデプロイ手順で必ず設定する。Phase 7）

## Phase 4: user/client ✅

受け入れ条件: Playwright E2E「登録→投稿→いいね→フォロー→通知受信」が通る。

- [x] P4-1 Vite + Vue Router + Pinia の土台、X レイアウト（左ナビ / 中央 / 右サイドバー、スマホは下部タブバー）
- [x] P4-2 認証画面と認証状態の管理（access token はメモリ、401 で refresh を 1 回だけ、起動時に Cookie から復元）
- [x] P4-3 タイムライン（おすすめ / フォロー中、無限スクロール）と投稿フォーム（280 文字のリング、画像 4 枚）
- [x] P4-4 投稿詳細・リプライ・リポスト・引用・いいね・ブックマーク（楽観的更新）
- [x] P4-5 プロフィール（投稿 / 返信 / メディア / いいね）とフォロー、フォロー一覧、プロフィール編集
- [x] P4-6 通知（Socket.IO でリアルタイム・未読バッジ）・検索・トレンド・ブックマーク・通報
- [x] P4-7 ダークモード（ライト / ダーク / システムに従う）
- [x] P4-8 E2E テスト（Playwright。登録 → 投稿 → フォロー・いいね → 通知のリアルタイム受信 / ログアウトと再ログイン の 2 件が合格。専用の DB と専用のポートで毎回まっさらに起動する: e2e/README.md）

## Phase 5: admin/server

受け入れ条件: すべての管理操作が AuditLog に記録される。

- [ ] P5-1 土台と管理者認証（別エンドポイント・別シークレット）、RBAC
- [ ] P5-2 ユーザー管理: 一覧・検索・凍結/解除・強制ログアウト・ロール変更
- [ ] P5-3 投稿管理: 一覧・検索・非表示/削除
- [ ] P5-4 通報管理: 一覧・ステータス変更・対応メモ
- [ ] P5-5 統計 API（DAU・投稿数・新規登録数）
- [ ] P5-6 監査ログの記録と閲覧 API

## Phase 6: admin/client

受け入れ条件: E2E「ユーザー凍結 → user 側でログイン拒否」が通る。

- [ ] P6-1 管理者ログインと画面の土台
- [ ] P6-2 ダッシュボード（グラフ）
- [ ] P6-3 ユーザー / 投稿 / 通報 / 監査ログの各管理画面
- [ ] P6-4 E2E テスト

## Phase 7: 仕上げ

受け入れ条件: CI が green。

- [x] P7-1 CI（GitHub Actions: lint / typecheck / test）。`hello.yml` を「XClone Arcade」（本物のチェック + おみくじ・ステータス・花火の遊び心）に作り替え済み。残り: DB を使うテスト（Phase 3 以降）を CI で動かすための PostgreSQL サービスの追加
- [ ] P7-2 README・ADR の整理、CLAUDE.md が 100 行以内か再確認
- [ ] P7-3 画面仕様書（Excel）を実画面のキャプチャ付きで再生成（`/screen-spec`）

## バックログ（将来の機能）

優先度が決まったら Phase を切って上に移す。実装前に `/adr` で方針を記録する。

- DM（ダイレクトメッセージ）
- リスト機能、ミュート・ブロック
- 投票（ポール）
- メールアドレス確認・パスワードリセット・2 要素認証
- 画像・動画のアップロード基盤（オブジェクトストレージ）と不適切コンテンツ検知
- 全文検索の強化（PostgreSQL の全文検索 / 拡張）
- おすすめアルゴリズムの改善（A/B テスト）
- 多言語対応（i18n）
- パフォーマンス計測とキャッシュ（Redis）
- 本番デプロイ（コンテナ化・CD）
