# @xclone/user-server — 一般ユーザー向け API

Express 5 + Kysely（SQL）+ Socket.IO。ポート 3000。API の一覧は [`docs/api/user.md`](../../docs/api/user.md)。

## 起動（リポジトリのルートで）

```powershell
pnpm db:migrate                       # テーブルを最新に（初回・マイグレーション追加後）
pnpm db:seed                          # テストデータ（任意。ログイン情報は docs/test-data.md）
pnpm --filter ./user/server dev       # 起動（ファイルを保存すると自動で再起動）
```

動作確認:

```powershell
curl.exe http://localhost:3000/api/health
# → {"status":"ok"}
curl.exe -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"alice@example.com\",\"password\":\"Password#123\"}'
```

## フォルダ構成（上から下へ処理が流れる）

```
src/
├── main.ts          # 起動・終了（Ctrl+C で DB を閉じる）
├── server.ts        # HTTP + Express + Socket.IO を組み立てる（テストでも使う）
├── app.ts           # ミドルウェアの順番（ヘッダー → CORS → requestId → JSON → API → エラー変換）
├── routes.ts        # URL と処理の対応表（ここを読めば API の全体が分かる）
├── controllers/     # 入力の検証 → service → 応答
├── services/        # ビジネスロジック（auth / user / post / timeline / notification / search / report）
├── queries/posts.ts # 投稿 ID の一覧 → 画面用の PostDto を SQL 1 回で作る（N+1 を作らない）
├── realtime/        # Socket.IO（接続時の認証・room・通知の配信）
├── middlewares/     # 認証・DAU の記録・requestId とアクセスログ・エラー変換
├── lib/             # トークン・パスワード・cursor・Cookie・画像 URL の確認
├── config.ts        # 環境変数を Zod で検証（process.env を直接読まない）
├── logger.ts        # pino（logs/user-server.log に JSON Lines。requestId つき）
└── errors.ts / mappers.ts / context.ts / deps.ts
test/                # API テスト（Supertest + 本物の PostgreSQL）
```

## テスト

```powershell
pnpm --filter ./user/server test
```

- 開発用 DB とは別の **`xclone_test`** を自動で作り、最新のマイグレーションを適用してから実行します（各テストの前に全テーブルを空にする）
- DB 名が `_test` で終わらないと実行を止めます（開発用の DB を誤って消さないため）
- 接続先は `TEST_DATABASE_URL` で変えられます（CI では GitHub Actions の PostgreSQL サービス）
- Socket.IO のテストは、実際にサーバーを起動して接続します

## 環境変数（`.env.example`）

| 名前                                                         | 既定値                | 内容                                                                    |
| ------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------- |
| `USER_SERVER_PORT`                                           | 3000                  | ポート                                                                  |
| `USER_CLIENT_ORIGIN`                                         | http://localhost:5173 | CORS・Socket.IO で許可する画面の URL                                    |
| `JWT_ACCESS_SECRET`                                          | 開発用の値            | access token の署名。**本番では必須**（開発用の値のままだと起動しない） |
| `PUBLIC_BASE_URL`                                            | http://localhost:3000 | アップロード画像の URL の先頭。これ以外の画像 URL は保存させない        |
| `UPLOAD_DIR` / `LOG_DIR`                                     | `uploads/` / `logs/`  | 画像とログの保存先                                                      |
| `AUTH_RATE_LIMIT_PER_MINUTE` / `MEDIA_RATE_LIMIT_PER_MINUTE` | 20 / 30               | 回数制限                                                                |
| `LOG_LEVEL`                                                  | info                  | ログの細かさ                                                            |
