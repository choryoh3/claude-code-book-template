# user/server API 一覧

一般ユーザー向け API（`user/server`、ポート 3000）の全エンドポイントです。実装は `user/server/src/routes.ts`、入出力の型は `packages/shared`（Zod スキーマと DTO）です。

> このファイルは `/api-doc` で、ルート定義と shared のスキーマから再生成できます。手で書いた説明（この「共通の約束」の節など）は残してください。

## 共通の約束

| 項目                | 内容                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ベース URL          | `http://localhost:3000/api`（画面からは Vite の proxy 経由で `/api`）                                                                                                           |
| 形式                | JSON（画像のアップロードだけ `multipart/form-data`）                                                                                                                            |
| 日時                | ISO 8601 の文字列（例 `2026-10-11T03:00:00.000Z`）                                                                                                                              |
| 認証                | `Authorization: Bearer <accessToken>`。「認証」列が「要」のものは、無い・無効なら 401、凍結中なら 403 `ACCOUNT_SUSPENDED`                                                       |
| refresh token       | httpOnly Cookie `xclone_refresh`（`Path=/api/auth`）。画面の JavaScript からは読めない                                                                                          |
| 一覧（cursor 方式） | `?cursor=&limit=`（limit は 1〜50、既定 20）。応答 `{ items, nextCursor }`。`nextCursor` を次の要求にそのまま渡す。`null` なら最後のページ                                      |
| エラー              | `{ "error": { "code", "message", "requestId", "fields"? } }`。`message` はそのまま画面に出せる日本語。`requestId` は問い合わせ・ログ調査（`pnpm logs:trace <requestId>`）に使う |
| 追跡                | すべての応答に `X-Request-Id` ヘッダー                                                                                                                                          |
| 回数制限            | 登録・ログイン: 1 分 20 回 / IP、画像のアップロード: 1 分 30 回 / IP（超えると 429 `TOO_MANY_REQUESTS`）                                                                        |

主なエラーコード: `VALIDATION_ERROR`(400) / `UNAUTHORIZED`・`TOKEN_EXPIRED`・`INVALID_CREDENTIALS`(401) / `FORBIDDEN`・`ACCOUNT_SUSPENDED`(403) / `NOT_FOUND`・`POST_NOT_FOUND`・`USER_NOT_FOUND`(404) / `EMAIL_TAKEN`・`HANDLE_TAKEN`・`ALREADY_REPORTED`(409) / `TOO_MANY_REQUESTS`(429) / `INTERNAL_ERROR`(500)

## 認証

| メソッド・パス        | 認証   | リクエスト                                                                                                                        | 成功時                                               | 主なエラー                                                                                                   |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /auth/register` | 不要   | `RegisterInput`（displayName 1〜50 / handle 3〜15 の英数字と `_` / email / password 8〜72 文字・英字と数字を含む・72 バイトまで） | 201 `AuthResponse` + Cookie                          | 400 / 409 `EMAIL_TAKEN`・`HANDLE_TAKEN`                                                                      |
| `POST /auth/login`    | 不要   | `LoginInput`（email / password）                                                                                                  | 200 `AuthResponse` + Cookie                          | 401 `INVALID_CREDENTIALS`（メールの有無は区別しない）/ 403 `ACCOUNT_SUSPENDED`（パスワードが正しいときだけ） |
| `POST /auth/refresh`  | Cookie | なし                                                                                                                              | 200 `AuthResponse` + 新しい Cookie（ローテーション） | 401 `TOKEN_EXPIRED` / 403                                                                                    |
| `POST /auth/logout`   | Cookie | なし                                                                                                                              | 204（Cookie を削除）                                 | -                                                                                                            |

- `AuthResponse` = `{ accessToken, expiresIn（秒・900）, user: CurrentUserDto }`
- 交換済みの refresh token が **10 秒以上たってから** 使われたら盗用を疑い、その人の token を全て失効させます（10 秒以内は複数タブの同時の再読み込みとみなし、その要求だけを 401 にします）

## 自分・ユーザー

| メソッド・パス                    | 認証 | リクエスト                                                                                                              | 成功時                                                                       | 主なエラー                                  |
| --------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| `GET /me`                         | 要   | -                                                                                                                       | 200 `CurrentUserDto`（id / handle / displayName / avatarUrl / email / role） | -                                           |
| `PATCH /me`                       | 要   | `UpdateProfileInput`（displayName / bio 160 文字まで / avatarUrl / headerUrl。送った項目だけ更新、`null` で画像を削除） | 200 `UserProfileDto`                                                         | 400（画像は `POST /media` で得た URL のみ） |
| `GET /users/availability?handle=` | 不要 | -                                                                                                                       | 200 `{ available }`（大文字小文字を区別しない）                              | 400                                         |
| `GET /users/:handle`              | 要   | -                                                                                                                       | 200 `UserProfileDto`（件数・`isFollowing`・`isSelf`・`isSuspended`）         | 404 `USER_NOT_FOUND`                        |
| `GET /users/:handle/posts`        | 要   | cursor                                                                                                                  | 200 `PostPage`（リプライを除く投稿）                                         | 404                                         |
| `GET /users/:handle/replies`      | 要   | cursor                                                                                                                  | 200 `PostPage`（リプライ）                                                   | 404                                         |
| `GET /users/:handle/media`        | 要   | cursor                                                                                                                  | 200 `PostPage`（画像つき）                                                   | 404                                         |
| `GET /users/:handle/likes`        | 要   | cursor                                                                                                                  | 200 `PostPage`（いいねした順）                                               | 404                                         |
| `GET /users/:handle/followers`    | 要   | cursor                                                                                                                  | 200 `UserPage`                                                               | 404                                         |
| `GET /users/:handle/following`    | 要   | cursor                                                                                                                  | 200 `UserPage`                                                               | 404                                         |
| `POST /users/:handle/follow`      | 要   | -                                                                                                                       | 200 `UserProfileDto`（何度呼んでも 1 回分。相手に `follow` 通知）            | 400（自分自身）/ 404                        |
| `DELETE /users/:handle/follow`    | 要   | -                                                                                                                       | 200 `UserProfileDto`                                                         | 404                                         |

凍結中のユーザーは、プロフィールが最小限（自己紹介・画像・件数なし、`isSuspended: true`）になり、各タブと一覧は空になります。

## 投稿・反応

| メソッド・パス                        | 認証 | リクエスト                                                                                         | 成功時                                                                                 | 主なエラー                                       |
| ------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `POST /posts`                         | 要   | `CreatePostInput`（content 280 文字まで / mediaUrls 4 枚まで / replyToId か quoteOfId のどちらか） | 201 `PostDto`                                                                          | 400 / 404 `POST_NOT_FOUND`（リプライ先・引用元） |
| `GET /posts/:id`                      | 要   | cursor（リプライ用）                                                                               | 200 `PostDetailDto`（`{ post, replies }`。削除済み・非表示は本文が空で `status` だけ） | 400 / 404                                        |
| `GET /posts/:id/replies`              | 要   | cursor                                                                                             | 200 `PostPage`（**古い順**）                                                           | 400                                              |
| `DELETE /posts/:id`                   | 要   | -                                                                                                  | 204（状態を「削除済み」にする）                                                        | 403（他人の投稿）/ 404                           |
| `POST` / `DELETE /posts/:id/like`     | 要   | -                                                                                                  | 200 `PostDto`（反応後の件数と `liked`）                                                | 404（削除済み・非表示を含む）                    |
| `POST` / `DELETE /posts/:id/repost`   | 要   | -                                                                                                  | 200 `PostDto`                                                                          | 404                                              |
| `POST` / `DELETE /posts/:id/bookmark` | 要   | -                                                                                                  | 200 `PostDto`                                                                          | 404                                              |

- 投稿すると、本文の `#タグ`（小文字にそろえる）を登録し、通知を作ります: リプライ先の投稿者に `reply`、引用元の投稿者に `quote`、メンションされた人に `mention`（リプライ先の人には `reply` だけ）
- いいね・リポストは投稿者に通知します（自分の投稿・ブックマーク・同じ操作の繰り返しでは通知しない）
- 画像の URL は `POST /media` で得た、このサーバーの URL だけを指定できます（外部の URL・`javascript:` は 400）

## タイムライン・ブックマーク

| メソッド・パス            | 認証 | 成功時         | 並び順                                                                                                                                                        |
| ------------------------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /timeline/following` | 要   | 200 `PostPage` | 自分とフォロー中の人の投稿（リプライを除く）と、その人たちのリポストを新しい順。リポストは `repostedBy` つき                                                  |
| `GET /timeline/for-you`   | 要   | 200 `PostPage` | 直近 7 日の自分以外の投稿を、スコア = (いいね + 2×リポスト + 1.5×リプライ + 1) ÷ (経過時間[時] + 2)^1.5 の高い順。1 ページ目の時刻で順位を固定（1000 件まで） |
| `GET /bookmarks`          | 要   | 200 `PostPage` | 保存した順                                                                                                                                                    |

## 通知

| メソッド・パス                    | 認証 | リクエスト                       | 成功時                                                                |
| --------------------------------- | ---- | -------------------------------- | --------------------------------------------------------------------- |
| `GET /notifications`              | 要   | `?filter=all\|mentions` + cursor | 200 `NotificationPage`（新しい順）                                    |
| `GET /notifications/unread-count` | 要   | -                                | 200 `{ count }`                                                       |
| `POST /notifications/read`        | 要   | -                                | 200 `{ count: 0 }`（すべて既読。開いている他のタブにも未読 0 を送る） |

### Socket.IO（リアルタイム）

接続: `io('http://localhost:3000', { auth: { token: accessToken } })`。不正なトークン・凍結中は接続を拒否します（`connect_error`）。

| 方向            | イベント                    | データ                                               |
| --------------- | --------------------------- | ---------------------------------------------------- |
| サーバー → 画面 | `notification:new`          | `{ notification: NotificationDto }`                  |
| サーバー → 画面 | `notification:unread-count` | `{ count }`（接続直後にも送る）                      |
| 画面 → サーバー | `notification:mark-read`    | ack で `{ ok, unreadCount }`（失敗時は `ok: false`） |

型は `packages/shared/src/socket.ts`（`SOCKET_EVENTS`・`ServerToClientEvents`・`ClientToServerEvents`）。

## 検索・トレンド

| メソッド・パス | 認証 | リクエスト                                              | 成功時                                                                                                                                                                          |
| -------------- | ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /search`  | 要   | `?q=`（1〜100 文字）`&type=posts\|users\|tags` + cursor | `posts`: `PostPage`（本文の部分一致。`#タグ` の形ならタグの完全一致）/ `users`: `UserPage`（ハンドル・表示名の部分一致、凍結中は除く）/ `tags`: `HashtagPage`（投稿数の多い順） |
| `GET /trends`  | 要   | -                                                       | 200 `{ items: [{ tag, postCount }] }`（直近 7 日の上位 10 件）                                                                                                                  |

検索語の `%` `_` はただの文字として扱います。

## 通報・画像

| メソッド・パス              | 認証 | リクエスト                                                                                                                        | 成功時                                             | 主なエラー                                               |
| --------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| `POST /reports`             | 要   | `CreateReportInput`（targetType `post\|user` / targetId / reason `spam\|harassment\|inappropriate\|other` / detail 500 文字まで） | 201 `{ id }`（「未対応」で保存。管理者が処理する） | 400（自分・自分の投稿）/ 404 / 409 `ALREADY_REPORTED`    |
| `POST /media`               | 要   | `multipart/form-data` の `file`（jpeg / png / webp、5MB まで）                                                                    | 201 `{ url }`                                      | 400（種類・大きさ。中身の先頭も確認し、偽装は拒否）/ 429 |
| `GET /uploads/<ファイル名>` | 不要 | -                                                                                                                                 | 画像                                               | 404                                                      |

## その他

| メソッド・パス | 認証 | 成功時                                      |
| -------------- | ---- | ------------------------------------------- |
| `GET /health`  | 不要 | 200 `{ status: 'ok' }`（DB への接続も確認） |
