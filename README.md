# X クローン SNS（管理者アプリ + 一般ユーザーアプリ）

X（旧 Twitter）の主要機能を再現した SNS です。**一般ユーザー向けアプリ** と **管理者向けアプリ** を物理的に分け、同じ PostgreSQL を共有します。
開発の大半を AI（Claude Code）が自走で進められるように、**開発の仕組みそのもの**も一緒に整えています。

> **このファイルの目的**: 初めてこのプロジェクトに触れる人（人間でも AI でも）が、これ 1 つで **全体像・起動方法・開発手順・「なぜそうしたか」** を理解できるようにすることです。

## 目次

1. [いまの状況](#1-いまの状況)
2. [全体像（完全理解マップ）](#2-全体像完全理解マップ)
3. [ローカルで起動する手順](#3-ローカルで起動する手順)
4. [フォルダ構成と、その理由](#4-フォルダ構成とその理由)
5. [技術スタックと、選んだ理由](#5-技術スタックと選んだ理由)
6. [開発の進め方（手順）](#6-開発の進め方手順)
7. [AI 運用基盤（Claude Code）](#7-ai-運用基盤claude-code)
8. [VS Code の設定と、その理由](#8-vs-code-の設定とその理由)
9. [その他の設定ファイルと、その理由](#9-その他の設定ファイルとその理由)
10. [テストデータ](#10-テストデータ)
11. [不具合が起きたとき（AI が調査しやすい仕組み）](#11-不具合が起きたときai-が調査しやすい仕組み)
12. [画面仕様書（Excel）](#12-画面仕様書excel)
13. [なぜこのように開発したのか（総括）](#13-なぜこのように開発したのか総括)
14. [後継者のためのガイド](#14-後継者のためのガイド)
15. [用語集（初心者向け）](#15-用語集初心者向け)
16. [付録](#16-付録)

---

## 1. いまの状況

開発は **Phase（段階）** に分けて進めます。現在は **Phase 0〜4（運用基盤・DB とテストデータ・共通パッケージ・ユーザー向け API・ユーザー向け画面）が完了** した段階です。**一般ユーザー向けのアプリ（画面 + API）は起動して使えます**。管理者アプリ（Phase 5〜6）はまだです。

| Phase | 内容                                                                              | 状態    |
| ----- | --------------------------------------------------------------------------------- | ------- |
| **0** | 運用基盤（CLAUDE.md・rules・skills・commands・agents・hooks・MCP・VS Code・docs） | ✅ 完了 |
| **1** | DB（SQL マイグレーション 13 テーブル・Kysely・テストデータ）                      | ✅ 完了 |
| **2** | 共通パッケージ（shared: API 契約 / ui: 共通部品）                                 | ✅ 完了 |
| **3** | user/server（認証・投稿・フォロー・タイムライン・通知・検索・通報・画像）         | ✅ 完了 |
| **4** | user/client（X のレイアウトの画面）+ E2E                                          | ✅ 完了 |
| 5     | admin/server（管理者認証・RBAC・管理操作・監査ログ）                              | ⏳      |
| 6     | admin/client（ダッシュボード・管理画面）                                          | ⏳      |
| 7     | 仕上げ（CI・README・画面仕様書のキャプチャ付き更新）                              | ⏳      |

- 詳しいタスクは [`docs/roadmap.md`](docs/roadmap.md)、これまでの記録は [`docs/progress.md`](docs/progress.md)
- **各 Phase の完了時にコミットし、次の Phase に進む前に人間が確認します**

### 作りたい機能

**一般ユーザー**: 認証（登録・ログイン・ログアウト・リフレッシュ）／投稿（280 文字・画像 4 枚・リプライ・リポスト・引用・いいね・ブックマーク・削除）／タイムライン（フォロー中・おすすめ・無限スクロール）／プロフィール／通知（リアルタイム）／検索・トレンド／通報／ダークモード

**管理者**: 別認証でのログイン／ダッシュボード（DAU・投稿数・新規登録数）／ユーザー管理（凍結・強制ログアウト・ロール変更）／投稿管理／通報管理／監査ログ

---

## 2. 全体像（完全理解マップ）

図は GitHub 上で自動的に描画されます。VS Code では拡張機能「Markdown Preview Mermaid Support」（推奨拡張に入れています）で見られます。

### 2-1. システム全体の構成

```mermaid
flowchart LR
  subgraph Browser["ブラウザ"]
    UC["user/client<br/>Vue 3 + Pinia<br/>:5173"]
    AC["admin/client<br/>Vue 3 + Pinia<br/>:5174"]
  end

  subgraph Servers["サーバー（Node.js 22 + Express 5）"]
    US["user/server<br/>:3000<br/>REST + Socket.IO"]
    AS["admin/server<br/>:3001<br/>REST"]
  end

  subgraph Shared["共有パッケージ（packages/）"]
    SH["shared<br/>Zod スキーマ・型"]
    DBP["db<br/>Kysely + SQL マイグレーション"]
    UI["ui<br/>トークン・共通部品"]
  end

  PG[("PostgreSQL<br/>xclone")]

  UC -- "HTTP / WebSocket" --> US
  AC -- "HTTP" --> AS
  US --> DBP
  AS --> DBP
  DBP --> PG
  UC -.使う.-> UI
  AC -.使う.-> UI
  UC -.使う.-> SH
  AC -.使う.-> SH
  US -.使う.-> SH
  AS -.使う.-> SH
```

**ポイント**

- `user` と `admin` は **互いに呼び合いません**。つながるのは「同じ DB」だけです（権限の境界を守るため。→ [ADR 0001](docs/adr/0001-monorepo-and-app-separation.md)）
- 画面と API の **約束事（型・入力ルール）は `shared` に 1 つだけ** 置き、両側が同じものを使います（食い違いによるバグを防ぐため）

### 2-2. データモデル（Phase 1 で実装済み）

主なテーブルと関係の概要です。全 13 テーブルの一覧・制約・インデックスは [`docs/db-schema.md`](docs/db-schema.md) にあります（正は `packages/db/migrations/*.sql`）。

```mermaid
erDiagram
  users ||--o{ posts : "投稿する"
  users ||--o{ follows : "フォローする（follower）"
  users ||--o{ follows : "フォローされる（followee）"
  users ||--o{ likes : "いいねする"
  users ||--o{ reposts : "リポストする"
  users ||--o{ bookmarks : "保存する"
  users ||--o{ notifications : "受け取る"
  users ||--o{ reports : "通報する"
  users ||--o{ refresh_tokens : "持つ"
  users ||--o{ audit_logs : "管理操作を記録（admin）"
  posts ||--o{ likes : ""
  posts ||--o{ reposts : ""
  posts ||--o{ bookmarks : ""
  posts ||--o{ posts : "リプライ・引用"
  posts ||--o{ post_hashtags : ""
  hashtags ||--o{ post_hashtags : ""

  users {
    uuid id PK
    text handle "一意"
    text email "一意"
    text password_hash
    text role "user か admin"
    boolean is_suspended
  }
  posts {
    uuid id PK
    uuid author_id FK
    text content "280文字まで"
    uuid reply_to_id FK
    uuid quote_of_id FK
    text status "表示中・非表示・削除済み"
  }
  follows {
    uuid follower_id PK
    uuid followee_id PK
  }
  notifications {
    uuid id PK
    uuid recipient_id FK
    text type "いいね・リポスト・フォロー・リプライ・メンション・引用"
    boolean is_read
  }
  reports {
    uuid id PK
    text status "未対応・対応中・完了"
    text admin_note
  }
  audit_logs {
    uuid id PK
    uuid admin_id FK
    text action
    jsonb detail
  }
```

### 2-3. ログインの流れ（認証）

```mermaid
sequenceDiagram
  participant B as ブラウザ（Vue）
  participant S as user/server
  participant D as PostgreSQL

  B->>S: POST /auth/login（メール・パスワード）
  S->>D: ユーザーを検索
  D-->>S: パスワードのハッシュ
  S->>S: bcrypt で照合・凍結チェック
  S->>D: refresh token（のハッシュ）を保存
  S-->>B: access token（本文）+ refresh token（httpOnly Cookie）
  Note over B: access token は「メモリ」だけに保持
  B->>S: API 呼び出し（Authorization: Bearer access token）
  S-->>B: 401（期限切れ）
  B->>S: POST /auth/refresh（Cookie を自動送信）
  S-->>B: 新しい access token（refresh もローテーション）
```

### 2-4. 「いいね」から通知がリアルタイムに届くまで

```mermaid
sequenceDiagram
  participant Bob as Bob の画面
  participant S as user/server
  participant D as PostgreSQL
  participant Alice as Alice の画面

  Bob->>S: POST /posts/:id/likes
  S->>D: いいねを保存 + 通知を保存（同じトランザクション）
  S-->>Bob: 200 OK（画面は先に更新済み = 楽観的更新）
  S-->>Alice: Socket.IO "notification:new"（room: user:Alice）
  Note over Alice: 通知バッジが +1。再読み込みしても通知一覧 API で復元できる
```

### 2-5. AI が自走で開発を進めるループ

```mermaid
flowchart TD
  A["/next を実行"] --> B["docs/roadmap.md と progress.md を読む<br/>次のタスクを決める"]
  B --> C["explorer が既存コードを調査"]
  C --> D["計画を作る（大きな設計の分岐だけ人が承認）"]
  D --> E["実装<br/>（rules / skills に従う。保存のたびに hooks が自動整形）"]
  E --> F["品質ゲート<br/>typecheck・lint・test"]
  F -- 失敗 --> G["原因を調べて直す<br/>（/debug・bug-investigator）"]
  G --> F
  F -- 成功 --> H["code-reviewer がレビュー<br/>🔴 重大が 0 件になるまで直す"]
  H --> I["seed・docs・ADR を更新<br/>progress.md に記録"]
  I --> J["コミット（Conventional Commits）"]
  J --> K{"Phase が終わった？"}
  K -- いいえ --> B
  K -- はい --> L["人に報告して確認を待つ（完了音「チーン」）"]
```

### 2-6. Claude Code の情報設計（4 層）

| 層  | 場所                | 読み込まれるとき                         | 入れるもの                                       |
| --- | ------------------- | ---------------------------------------- | ------------------------------------------------ |
| 1   | `CLAUDE.md`         | **常時**                                 | 概要・コマンド・構成図・絶対ルール（100 行以内） |
| 2   | `.claude/rules/`    | **編集するファイルのパスが一致したとき** | 領域ごとの規約                                   |
| 3   | `.claude/skills/`   | **AI が必要と判断したとき**              | 手順書・テンプレート                             |
| 4   | `.claude/commands/` | **人が `/コマンド` で呼んだとき**        | 定型ワークフロー                                 |

「誰が動くか」の軸では、Claude 本体 / サブエージェント（agents）/ シェル（hooks）/ 外部サービス（MCP）に分かれます（→ [7 章](#7-ai-運用基盤claude-code)）。

---

## 3. ローカルで起動する手順

> **すべて PowerShell（Windows 11）で、リポジトリのルートで実行します。** `&&` は使えません（Windows PowerShell 5.1 のため）。1 行ずつ実行してください。

### 3-0. 今どこまで動くか（重要）

**DB（テーブルとテストデータ）までは今すぐ動きます**（Phase 1 完了）。一方、画面と API は Phase 2〜6 で作るため、**現時点では `pnpm dev` を実行してもアプリは起動しません**（起動対象がまだ無いため）。
下の表のとおり、手順は **完成後と同じもの** を先に書いています。Phase が進むごとに動く範囲が増えます。

| 手順                                          | 今すぐ動く                        | 動き始める Phase          |
| --------------------------------------------- | --------------------------------- | ------------------------- |
| 3-1 前提ツールの確認                          | ✅                                | -                         |
| 3-2 依存のインストール                        | ✅                                | -                         |
| 3-3 環境変数                                  | ✅                                | -                         |
| 3-4 DB の起動（空の PostgreSQL）              | ✅                                | -                         |
| 3-5 マイグレーションとテストデータ            | ✅                                | -（Phase 1 完了）         |
| 3-6 アプリの起動                              | ✅ 一般ユーザー向け（画面 + API） | 管理者アプリは Phase 5〜6 |
| 画面仕様書（Excel）の生成 `pnpm spec:screens` | ✅                                | -                         |

### 3-1. 前提ツールを確認する

```powershell
node -v      # v22.x であること（.nvmrc に 22 と書いてあります）
pnpm -v      # 10.x であること
git --version
docker --version   # DB を Docker で動かす場合のみ
```

`pnpm` が見つからないときは、**管理者権限なし** で入れられる次のコマンドを使います（`corepack enable` は管理者権限が要るため使いません。→ [docs/troubleshooting.md](docs/troubleshooting.md)）。

```powershell
npm i -g pnpm@10
```

入れたあとはターミナルを開き直して、もう一度 `pnpm -v` を確認してください。

### 3-2. 依存パッケージをインストールする

```powershell
git clone https://github.com/choryoh3/claude-code-book-template.git
cd claude-code-book-template
pnpm install
```

- `pnpm install` が終わると、Git の pre-commit（コミット前の自動チェック）も自動で有効になります（husky）
- Node のバージョンは 22 を使ってください。nvm を使っている場合は `nvm use`

### 3-3. 環境変数ファイルを作る

```powershell
Copy-Item .env.example .env
```

`.env` は Git に入りません（秘密情報の置き場所）。開発用のそのままの値で動きます。

### 3-4. データベース（PostgreSQL）を起動する

PostgreSQL 16 以上が必要です。どちらか 1 つの方法で用意してください。

**方法 A: すでにあるローカルの PostgreSQL を使う（この PC で動作確認済み: PostgreSQL 17）**

```powershell
# psql が PATH に無い場合は、フルパスで実行します（バージョンの数字は環境に合わせる）
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$env:PGPASSWORD = "test999"      # このターミナルでだけ有効（パスワードの入力を省略するため）

& $psql -h localhost -U postgres -c "SELECT version();"         # 接続できることを確認
& $psql -h localhost -U postgres -c "CREATE DATABASE xclone;"   # DB を作成（すでにあるとエラーになるが問題なし）
```

**方法 B: Docker を使う（Docker がある場合。※この PC には Docker が無いため動作は未確認）**

```powershell
docker compose up -d      # PostgreSQL 16 を起動（ユーザー postgres / パスワード test999 / DB xclone）
docker compose ps         # State が running であることを確認
```

接続先は環境変数 `DATABASE_URL` で決まります（既定: `postgresql://postgres:test999@localhost:5432/xclone`）。`.env` が無くても、この既定値で動きます。

### 3-5. テーブルとテストデータを作る（Phase 1 完了済み・動作確認済み）

```powershell
pnpm db:migrate     # SQL マイグレーションを適用して、13 個のテーブルを作る
pnpm db:seed        # 動作確認用のテストデータを入れる（既存データは全て消えて入れ直し）
```

成功すると、次のように件数が表示されます。

```
投入しました:
  users                   32 件
  posts                  200 件
  notifications          110 件
  ...
```

**中身を確認する**（テストデータが入ったか見たいとき）

```powershell
& $psql -h localhost -U postgres -d xclone -c "SELECT handle, role, is_suspended FROM users ORDER BY created_at LIMIT 8;"
& $psql -h localhost -U postgres -d xclone -c "SELECT status, count(*) FROM posts GROUP BY status;"
```

VS Code の拡張機能「PostgreSQL」（`ckolkman.vscode-postgres`）からも、画面で確認できます（接続: localhost / postgres / test999 / xclone）。

**よく使う操作**

| やりたいこと                                   | コマンド                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 型を最新にする（マイグレーションを足したあと） | `pnpm db:codegen`                                                                                        |
| 直近 1 件のマイグレーションを取り消す          | `pnpm --filter "@xclone/db" migrate:down`                                                                |
| 全部消して作り直す（⚠ 全データが消える）       | Claude Code で **`/db-reset`**（確認つき）。手で `pnpm db:reset` を実行することは hooks がブロックします |
| 毎回同じ日付のデータにしたい（E2E など）       | `$env:SEED_BASE_DATE = "2026-10-11"; pnpm db:seed`                                                       |

入る内容とログイン情報は [`docs/test-data.md`](docs/test-data.md)、テーブルの一覧は [`docs/db-schema.md`](docs/db-schema.md) です。

### 3-6. アプリを起動する

**今すぐ使える: 一般ユーザー向けのアプリ（画面 + API）**（Phase 4 完了）

```powershell
pnpm dev            # user/server（http://localhost:3000）と user/client（http://localhost:5173）をまとめて起動
```

ブラウザで **http://localhost:5173** を開き、テストデータの `alice@example.com` / `Password#123` でログインします（画面の `/api` への通信は、Vite が 3000 番の API に転送します）。
保存すると、画面はすぐに反映され、API は自動で再起動します。止めるときは Ctrl + C です。

個別に起動したいとき:

```powershell
pnpm --filter ./user/server dev          # API だけ（http://localhost:3000）
pnpm --filter ./user/client dev          # 画面だけ（http://localhost:5173。API も起動しておく）
```

API だけを、別のターミナルから確かめることもできます。

```powershell
curl.exe http://localhost:3000/api/health
# → {"status":"ok"}

# テストデータの alice でログイン（accessToken が返る）
curl.exe -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"alice@example.com\",\"password\":\"Password#123\"}'
```

API の一覧は [`docs/api/user.md`](docs/api/user.md)、テストは `pnpm --filter ./user/server test`（テスト用 DB `xclone_test` を自動で作ります）。

E2E テスト（ブラウザを実際に操作する）は `pnpm test:e2e` です（専用の DB とポートで動くので、開発中のサーバーと並行して実行できます。[`e2e/README.md`](e2e/README.md)）。

**全部そろったら（Phase 5〜6 の完了後）** は、`pnpm dev` で管理者アプリも一緒に起動します。ブラウザで開く URL は次のとおりです。

| アプリ       | URL                   | 役割                            |
| ------------ | --------------------- | ------------------------------- |
| ユーザー画面 | http://localhost:5173 | 一般ユーザー向け（X の画面）    |
| ユーザー API | http://localhost:3000 | user/server（REST + Socket.IO） |
| 管理画面     | http://localhost:5174 | 管理者向け                      |
| 管理 API     | http://localhost:3001 | admin/server（REST）            |

**ログインできるテストアカウント**（開発専用。詳細は [`docs/test-data.md`](docs/test-data.md)）

| アプリ       | メール              | パスワード     | 用途                           |
| ------------ | ------------------- | -------------- | ------------------------------ |
| ユーザー画面 | `alice@example.com` | `Password#123` | メインの確認用                 |
| ユーザー画面 | `dave@example.com`  | `Password#123` | 凍結済み（ログイン拒否の確認） |
| 管理画面     | `admin@example.com` | `Admin#12345`  | すべての管理操作               |

**一部だけ起動したいとき**（例）

```powershell
pnpm --filter ./user/server dev      # ユーザー API だけ
pnpm --filter ./user/client dev      # ユーザー画面だけ
pnpm --filter ./admin/server dev     # 管理 API だけ
pnpm --filter ./admin/client dev     # 管理画面だけ
```

**止めるとき**

```powershell
# pnpm dev を動かしているターミナルで Ctrl + C
docker compose stop      # DB を止める（データは残る）
docker compose down      # DB のコンテナを削除（データ用ボリュームは残る）
```

### 3-7. 起動でつまずいたとき

| 症状                                                         | 原因と対処                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `pnpm : The term 'pnpm' is not recognized`                   | `npm i -g pnpm@10` を実行し、ターミナルを開き直す                                                            |
| `EADDRINUSE: address already in use :::3000`（ポート使用中） | `netstat -ano \| findstr :3000` で PID を調べ、`taskkill /PID <PID> /F` で止める                             |
| `ECONNREFUSED 127.0.0.1:5432`（DB に繋がらない）             | `docker compose ps` で DB が running か確認。ローカル DB なら PostgreSQL のサービスが起動しているか確認      |
| `password authentication failed`                             | `.env` の `DATABASE_URL` のパスワードが DB と一致しているか確認                                              |
| 保存時に ESLint のエラーが出続ける                           | `pnpm exec eslint <ファイル>` を手で実行して内容を確認。→ [docs/troubleshooting.md](docs/troubleshooting.md) |
| そのほか                                                     | 画面や API のエラーは `pnpm logs:errors`、詳しくは [11 章](#11-不具合が起きたときai-が調査しやすい仕組み)    |

---

## 4. フォルダ構成と、その理由

```
.
├── CLAUDE.md                    # AI への「常に必要な」指示（100 行以内）
├── README.md                    # このファイル（人間向けの全体ガイド）
├── .claude/                     # Claude Code の運用基盤
│   ├── settings.json            #   hooks（自動処理）と権限
│   ├── rules/                   #   領域別の規約（編集時に自動で読み込まれる）
│   ├── skills/                  #   手順書（AI が必要なときに読む）
│   ├── commands/                #   /コマンド（人が呼ぶ定型作業）
│   ├── agents/                  #   サブエージェント（役割ごとの担当者）
│   └── hooks/                   #   hooks のスクリプト（Node.js）
├── .mcp.json                    # MCP サーバー（DB・ブラウザ・ドキュメント・GitHub）
├── .vscode/                     # VS Code の設定（チーム共通）
├── .husky/                      # コミット前の自動チェック
├── .github/                     # PR / Issue のテンプレート、GitHub Actions
├── admin/
│   ├── client/                  # 管理画面（Vue 3）        :5174
│   └── server/                  # 管理 API（Express 5）    :3001
├── user/
│   ├── client/                  # ユーザー画面（Vue 3）    :5173
│   └── server/                  # ユーザー API（Express 5）:3000
├── packages/
│   ├── db/                      # SQL マイグレーション・Kysely・テストデータ(seed)
│   ├── shared/                  # Zod スキーマ・型・定数（API 契約の唯一の真実）
│   └── ui/                      # デザイントークン（tokens.css）・共通部品
├── e2e/                         # Playwright の E2E テスト
├── scripts/                     # 補助スクリプト（ログ調査・画面仕様書の生成）
├── docs/
│   ├── adr/                     # 設計判断の記録（なぜそう決めたか）
│   ├── api/                     # API 一覧（/api-doc で生成）
│   ├── screens/                 # 画面仕様書（Excel）と元データ・キャプチャ
│   ├── roadmap.md               # タスク台帳（次にやること）
│   ├── progress.md              # 進捗の記録（やったこと・判断・次の一手）
│   ├── test-data.md             # テストデータの仕様
│   ├── troubleshooting.md       # つまずきの記録（症状→原因→対処）
│   └── notes/                   # 個人メモ（GitHub CLI、Claude Code の整理）
├── docker-compose.yml           # PostgreSQL（任意）
├── pnpm-workspace.yaml          # モノレポの範囲
├── package.json                 # ルートのコマンド集
└── tsconfig.base.json / eslint.config.mjs / .prettierrc / .editorconfig ...
```

### この構成にした理由

| 決めたこと                                  | 理由                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **`admin/` と `user/` を物理的に分ける**    | 管理者機能の欠陥や権限の事故が一般ユーザー側に及ぶのを防ぐため。利用者もポートも認証も別にできる                            |
| **各アプリを `client` / `server` に分ける** | 画面と API の役割を分けると、変更の影響範囲が小さく、テストもしやすい                                                       |
| **共通部分を `packages/` に集める**         | 型・DB・見た目を 1 か所に置けば、両アプリで食い違わない。「同じ内容を 2 回書かない」                                        |
| **`shared` を API 契約の唯一の真実にする**  | 画面と API で入力ルールが違うバグ（例: 画面は 300 文字 OK、API は 280 文字まで）を構造的に防ぐ                              |
| **`docs/` に「なぜ」を残す**                | コードを読んでも分からない理由（設計判断）が、人や AI が替わっても引き継がれる                                              |
| **`.claude/` を情報の種類ごとに分ける**     | 常に読む情報を最小にして、重要な指示が埋もれないようにする（[ADR 0006](docs/adr/0006-claude-code-operating-foundation.md)） |
| **各フォルダに README を置く**              | フォルダの役割がその場で分かる（初めての人が迷わない）                                                                      |

---

## 5. 技術スタックと、選んだ理由

| 領域               | 技術                                                         | 選んだ理由                                                                                                                              |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| パッケージ管理     | **pnpm workspaces**                                          | 複数アプリを 1 リポジトリで管理でき、依存の重複が少なく高速（[ADR 0001](docs/adr/0001-monorepo-and-app-separation.md)）                 |
| 画面               | **Vue 3**（`<script setup lang="ts">`）+ Vite + Vue Router   | 学習しやすく型安全。Vite は起動・反映が速い                                                                                             |
| 状態管理           | **Pinia**                                                    | Vue 公式の推奨。Redux Toolkit は React 向けで Vue では利点が出ないため不採用（[ADR 0002](docs/adr/0002-pinia-for-state-management.md)） |
| サーバー           | **Node.js 22 + Express 5 + TypeScript**                      | Express 5 は async の例外を自動処理でき、コードが短くなる。TypeScript は `tsx` で開発実行                                               |
| 入力検証           | **Zod**（client / server 共有）                              | 同じルールを両側で使え、型も自動で作れる                                                                                                |
| DB                 | **PostgreSQL** + **Kysely**（SQL）+ SQL マイグレーション     | 性能のため SQL を直接制御したい。Prisma は不採用（[ADR 0003](docs/adr/0003-kysely-and-sql-migrations.md)）                              |
| 認証               | **JWT**（access: メモリ / refresh: httpOnly Cookie）+ bcrypt | XSS に強く、凍結を即時反映できる（[ADR 0004](docs/adr/0004-jwt-auth-strategy.md)）                                                      |
| リアルタイム       | **Socket.IO**                                                | 切断時の再接続や room など、通知配信に必要な機能が揃っている                                                                            |
| スタイル           | **Tailwind CSS v4** + CSS 変数のデザイントークン             | ダークモードをトークン 1 か所で切り替えられる（[ADR 0005](docs/adr/0005-tailwind-v4-and-design-tokens.md)）                             |
| UI 部品            | 自作 + **Radix Vue**、アイコンは **lucide-vue-next**         | ダイアログなどのアクセシビリティを自前で作らずに済む                                                                                    |
| テスト             | **Vitest** / Vue Test Utils / **Supertest** / **Playwright** | 単体・コンポーネント・API・E2E を一通りカバー                                                                                           |
| Lint / 整形        | **ESLint**（flat config + @antfu）+ **Prettier**             | ESLint は「誤りの検出」、Prettier は「見た目の統一」と役割を分ける                                                                      |
| コミット前チェック | **Husky + lint-staged**                                      | 変更したファイルだけを自動チェックし、崩れたコードを入れない                                                                            |
| ログ               | **pino**（JSON Lines）                                       | 機械で検索しやすく、AI が不具合を追いやすい                                                                                             |

### バージョンを固定している理由

最新版を入れたところ、ツール同士の組み合わせで動かない問題が出たため、**動作確認できた組み合わせに固定**しています（[ADR 0007](docs/adr/0007-toolchain-version-pins.md)）。

| ツール               | 固定    | 理由                                                  |
| -------------------- | ------- | ----------------------------------------------------- |
| Node                 | 22      | 指示どおり（LTS）                                     |
| pnpm                 | 10      | 指示どおり                                            |
| TypeScript           | `~5.9`  | 7.0 は typescript-eslint が未対応で ESLint が動かない |
| ESLint               | `^9`    | antfu config 7.7 が対応                               |
| @antfu/eslint-config | `7.7.3` | 上記と組み合わせて動作確認済み                        |

---

## 6. 開発の進め方（手順）

### 6-1. 基本の流れ（AI に任せる場合）

1. Claude Code を起動する（このリポジトリのルートで `claude`）
2. 次の作業を進めるには **`/next`** と入力する（`docs/roadmap.md` の最初の未完了タスクを、計画 → 実装 → 検証 → 記録まで自走で進めます）
3. 設計の大きな分岐や Phase の完了のときだけ、AI が人に確認します
4. 完了すると **「チーン」** と音が鳴ります

特定の機能を作りたいときは `/feature <説明>`、不具合は `/debug <症状>` を使います。

### 6-2. 1 つの機能を作るときの標準手順

```mermaid
flowchart LR
  A["1. 契約<br/>shared に<br/>Zod スキーマ"] --> B["2. DB<br/>SQL マイグレーション<br/>→ db:codegen"]
  B --> C["3. API<br/>service → controller<br/>→ route"]
  C --> D["4. テスト<br/>Supertest"]
  D --> E["5. 画面<br/>api → store<br/>→ composable → page"]
  E --> F["6. E2E<br/>Playwright"]
  F --> G["7. 後始末<br/>seed・docs・ADR"]
```

**内側（契約）から外側（画面）へ** 作ります。各ステップで動作確認でき、手戻りが少ないためです。手順の詳細は skill（`api-endpoint` / `vue-feature` / `db-migration`）にあります。

### 6-3. 品質ゲート（コミット前に必ず）

```powershell
pnpm check       # typecheck + lint + test をまとめて実行
```

すべて通り、`code-reviewer` の「🔴 重大」が 0 件になったらコミットします。

### 6-4. コミットと PR

- コミットメッセージは **Conventional Commits**（例: `feat(user-client): add timeline`、`chore(claude): add hooks`）
- 論理的なまとまりごとにコミットする。`git push --force` は hooks がブロックします
- PR は `/pr`（`.github/PULL_REQUEST_TEMPLATE.md` に沿って作成）
- コミット時は husky が、変更したファイルに Prettier と ESLint を自動で実行します

### 6-4b. 設計判断の記録

ライブラリ選定・データモデル・認証方式など **「なぜ」が重要な決定** は、実装の前に `/adr <タイトル>` で `docs/adr/` に記録します。

### 6-5. 毎日使うコマンド

| コマンド                                     | 内容                         |
| -------------------------------------------- | ---------------------------- |
| `pnpm install`                               | 依存をインストール           |
| `pnpm dev`                                   | 全アプリを起動               |
| `pnpm check`                                 | 型チェック + lint + テスト   |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | 個別に実行                   |
| `pnpm lint:fix` / `pnpm format`              | 自動修正 / 全体を整形        |
| `pnpm test:e2e`                              | Playwright の E2E            |
| `pnpm db:migrate`                            | SQL マイグレーションを適用   |
| `pnpm db:codegen`                            | 実 DB から Kysely の型を生成 |
| `pnpm db:seed`                               | テストデータを投入           |
| `pnpm logs:errors`                           | 直近のエラーログを一覧       |
| `pnpm logs:trace <requestId>`                | 1 リクエストの全ログを追う   |
| `pnpm spec:screens`                          | 画面仕様書（Excel）を生成    |

### 6-6. Claude Code のスラッシュコマンド

| コマンド            | 内容                                                      |
| ------------------- | --------------------------------------------------------- |
| `/next`             | roadmap の次のタスクを自走で進める                        |
| `/feature <説明>`   | 計画 → 実装 → テスト → lint → ドキュメント更新 → コミット |
| `/debug <症状>`     | 不具合の調査 → 回帰テスト → 修正                          |
| `/review`           | `code-reviewer` で差分をレビュー                          |
| `/test [path]`      | テスト実行、失敗の原因と修正案                            |
| `/db-reset`         | 開発 DB を初期化（**必ず確認つき**）                      |
| `/api-doc`          | `docs/api/` を最新のコードから再生成                      |
| `/adr <タイトル>`   | 設計判断の記録を作成                                      |
| `/pr`               | ブランチを push して PR を作成                            |
| `/screen-spec [ID]` | 実画面をキャプチャして画面仕様書を更新                    |

### 6-7. GitHub Actions（🎮 XClone Arcade）

`.github/workflows/hello.yml` は、push するたびに **ゲームのようにステージが進む** ワークフローです。中身は本物の CI（整形・lint・型・テスト）に、遊び心を足したものです。

```mermaid
flowchart LR
  S["🚀 スタート<br/>バナー + カウントダウン"] --> C["🧪 チェック（本物の CI）<br/>整形・lint・型・テスト → 🥇 メダル"]
  S --> O["🥠 おみくじ<br/>今日の運勢"]
  S --> T["📊 ステータス<br/>レベル・内訳（円グラフ）"]
  C --> F["🎆 フィナーレ<br/>花火 / スロット / おみくじ"]
  O --> F
  T --> F
```

| 見どころ                      | 内容                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ログ                          | 色つきのバナー、3・2・1 のカウントダウン、花火（またはスロット）のアニメーション風の出力                                                    |
| **Summary**（実行画面の下部） | チェックの結果（🥇 クリア / 💥 ミス）、おみくじ、リポジトリの **レベル**（コミット 5 回ごとに 1 上がる）、ファイル種類の円グラフ（Mermaid） |
| 手動実行                      | Actions タブ →「🎮 XClone Arcade」→ **Run workflow** で、フィナーレのテーマ（🎆 花火 / 🎰 スロット / 🥠 おみくじ）を選べる                  |
| 失敗したとき                  | 「💥 ゲームオーバー」と表示され、`docs/troubleshooting.md` への道しるべが出る（実行は失敗扱いになる）                                       |

- **チェックは本物**です。失敗するとワークフロー全体が失敗します（main に壊れたコードを入れないための番人）
- 確認方法: push 後、GitHub の **Actions タブ**、または `gh run list` → `gh run watch`（`gh` の使い方は [付録](#16-付録)）
- 外部の文字列（コミットメッセージ・ユーザー名）は、スクリプトに直接埋め込まず環境変数で渡しています（インジェクション対策）

---

## 7. AI 運用基盤（Claude Code）

「AI に開発の 9 割を任せる」ために、**AI が迷わず・品質を保ち・途中で止まっても引き継げる** 仕組みを作りました。

### 7-1. rules（編集するファイルに応じて自動で読み込まれる規約）

| ファイル              | 対象                                 | 内容                                                                                           |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `code-quality.md`     | すべての TS / Vue / mjs              | 読みやすさ（命名・関数の長さ・コメントの書き方）。**わかりやすい日本語コメントを積極的に書く** |
| `vue-client.md`       | `**/client/**`                       | `<script setup>`・Pinia・composable・認証トークンの扱い                                        |
| `express-server.md`   | `**/server/**`                       | 層構造（route → controller → service）、Zod 検証、DTO への変換                                 |
| `db.md`               | `packages/db/**`                     | SQL マイグレーション・Kysely・N+1 禁止・インデックス                                           |
| `shared-contracts.md` | `packages/shared/**`                 | スキーマから型を作る、破壊的変更の扱い                                                         |
| `styling.md`          | `*.vue` / `*.css` / `packages/ui/**` | Tailwind v4・トークン・アクセシビリティ                                                        |
| `testing.md`          | `*.test.ts` / `e2e/**`               | テストの書き方・命名・E2E の注意                                                               |
| `admin-security.md`   | `admin/**`                           | RBAC・監査ログを同一トランザクションで記録                                                     |
| `observability.md`    | `**/server/**`                       | pino・`requestId`・エラー形式（不具合調査のため）                                              |

### 7-2. skills（AI が必要と判断したときに読む手順書）

`vue-feature`（画面追加）/ `api-endpoint`（API 追加）/ `db-migration`（DB 変更・性能改善）/ `x-ui-patterns`（X の UI 仕様）/ `realtime-socket`（Socket.IO）/ `e2e-playwright`（E2E）/ `debugging`（不具合調査）

### 7-3. agents（役割ごとの担当者。権限は最小限）

| エージェント       | 役割                                              | 使える道具                |
| ------------------ | ------------------------------------------------- | ------------------------- |
| `code-reviewer`    | 差分のレビュー（セキュリティ・N+1・型・境界違反） | 読み取りのみ              |
| `test-writer`      | テストコードだけを書く（実装は変更しない）        | 読み書き（テスト用）      |
| `db-architect`     | スキーマ・インデックス・性能の分析                | 読み取り + DB（読み取り） |
| `ui-verifier`      | ブラウザで画面を確認し、X の UI と比較            | Playwright MCP            |
| `explorer`         | コードの調査（メインの文脈を汚さない）            | 読み取りのみ              |
| `bug-investigator` | 不具合の原因調査（ログ・DB・コードを突き合わせ）  | 読み取り + DB + ブラウザ  |

**権限を絞る理由**: 「レビュー担当がコードを勝手に直す」といった事故を防ぎ、役割を明確にするためです。

### 7-4. hooks（規約を「仕組み」で守らせる自動処理）

| いつ                                   | 何をする                                                                   | スクリプト          |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| ファイル編集の**あと**                 | Prettier で整形 → ESLint で自動修正。直せない問題は AI に返す              | `format.mjs`        |
| 編集の**あと**（マイグレーション SQL） | 「`db:migrate` → `db:codegen` → seed 更新」を通知                          | `db-notice.mjs`     |
| コマンド実行の**前**                   | `rm -rf`、`git push --force`、DB のリセット、`DROP DATABASE` をブロック    | `guard-bash.mjs`    |
| 編集の**前**                           | `.env`、**適用済みマイグレーション**、**自動生成ファイル**の編集をブロック | `guard-edit.mjs`    |
| 作業の**終了時**                       | 変更があれば `pnpm typecheck` を実行して報告                               | `typecheck.mjs`     |
| 作業の**終了時** / 確認待ち            | **「チーン」と音で知らせる**（無効化: 環境変数 `CLAUDE_SOUND_OFF=1`）      | `notify-sound.mjs`  |
| セッション開始時                       | ブランチと未コミットの変更を表示                                           | `session-start.mjs` |

**hooks にする理由**: 「お願い」は AI が見落とすことがありますが、hooks は **必ず実行されます**。危険な操作は仕組みで止めるのが確実です。
hooks は動作テスト済みです（ブロックすべきものを止め、通すべきものを通すことを確認）。設定の変更は **新しいセッションから有効** になります。

### 7-5. MCP（外部サービスとの連携）

| サーバー     | できること                                                           |
| ------------ | -------------------------------------------------------------------- |
| `postgres`   | DB のスキーマ・実データを SQL で確認（`EXPLAIN` も）                 |
| `playwright` | ブラウザ操作・スクリーンショット（画面確認・画面仕様書のキャプチャ） |
| `context7`   | Vue / Pinia / Express 5 / Tailwind v4 などの最新ドキュメントを参照   |
| `github`     | PR / Issue の操作（`GITHUB_PERSONAL_ACCESS_TOKEN` 環境変数が必要）   |

DB の接続先は環境変数 `DATABASE_URL`（未設定なら開発用の既定値 `postgresql://postgres:test999@localhost:5432/xclone`）です。

### 7-6. permissions（許可と拒否）

- **許可**: `pnpm *`、`git status / diff / log / add / commit`、`gh pr *`
- **拒否**: `.env` の読み取り（AI に秘密情報を見せない）

---

## 8. VS Code の設定と、その理由

`.vscode/` の内容を **すべて** 記載します。チーム全員が同じ設定で作業でき、AI が書いたコードも同じ基準で自動整形されます。

### 8-1. `settings.json`

| 設定                                                           | 値                                                                                                                 | 理由                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `editor.formatOnSave`                                          | `true`                                                                                                             | 保存するたびに整形され、コードの見た目が常に揃う                                           |
| `editor.defaultFormatter`                                      | Prettier                                                                                                           | 整形ルールを Prettier に一本化し、議論を無くす                                             |
| `editor.codeActionsOnSave` → `source.fixAll.eslint`            | `explicit`                                                                                                         | 保存時に ESLint の自動修正を実行（未使用 import の削除など）                               |
| `editor.codeActionsOnSave` → `source.organizeImports`          | `never`                                                                                                            | VS Code 標準の import 整理は ESLint の並び順ルールと衝突するため、ESLint に任せる          |
| `[vue]` `[typescript]` `[json]` `[jsonc]` `[css]` の formatter | Prettier                                                                                                           | 言語ごとに別の整形ツールが使われて競合するのを防ぐ                                         |
| `[sql]` → `editor.formatOnSave`                                | `false`                                                                                                            | 手で調整したマイグレーションや性能チューニングした SQL を、自動整形で崩さないため          |
| `typescript.tsdk`                                              | `node_modules/typescript/lib`                                                                                      | **プロジェクトで固定した TypeScript 5.9** を使う（VS Code 内蔵版との差による誤表示を防ぐ） |
| `typescript.preferences.importModuleSpecifier`                 | `non-relative`                                                                                                     | `../../../` のような相対パスの連鎖を避け、`@/…` で読みやすくする                           |
| `tailwindCSS.experimental.classRegex`                          | `cva(...)` / `cn(...)`                                                                                             | これらの関数の中のクラス名にも Tailwind の補完を効かせる                                   |
| `files.exclude` / `search.exclude`                             | `node_modules` `dist` `.turbo` `coverage`（検索はさらに `pnpm-lock.yaml` `logs`）                                  | 一覧と検索のノイズを減らし、動作も軽くする                                                 |
| `eslint.workingDirectories`                                    | `[{ "mode": "auto" }]`                                                                                             | モノレポで、ファイルに最も近い設定の場所を自動で選ぶ                                       |
| `eslint.useFlatConfig`                                         | `true`                                                                                                             | `eslint.config.mjs`（flat config）を使うため                                               |
| `vitest.enable`                                                | `true`                                                                                                             | エディタ上でテストを実行・確認できる                                                       |
| `files.associations`                                           | `*.css` → `tailwindcss`                                                                                            | `@theme` などの Tailwind 独自の書き方を CSS の誤りとして警告しない                         |
| `explorer.fileNesting`                                         | `*.ts` の下に `*.test.ts` / `*.spec.ts`、`package.json` の下にロックファイル類、`eslint.config.mjs` の下に整形設定 | エクスプローラーを見やすくする                                                             |

### 8-2. `extensions.json`（推奨拡張機能）

| 拡張機能                                | 理由                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `Vue.volar`                             | Vue 3 + TypeScript の公式サポート                             |
| `dbaeumer.vscode-eslint`                | 保存時の自動修正・エラー表示                                  |
| `esbenp.prettier-vscode`                | 保存時の整形                                                  |
| `bradlc.vscode-tailwindcss`             | クラス名の補完とプレビュー                                    |
| `vitest.explorer`                       | テストの一覧・実行・デバッグ                                  |
| `ms-playwright.playwright`              | E2E の実行・記録                                              |
| `usernamehw.errorlens`                  | エラーを行の横にその場で表示（気づきやすい）                  |
| `streetsidesoftware.code-spell-checker` | 英語の綴りミスの発見                                          |
| `eamodio.gitlens`                       | 誰がなぜ変えたか（blame・履歴）を確認                         |
| `EditorConfig.EditorConfig`             | `.editorconfig` を反映                                        |
| `ckolkman.vscode-postgres`              | エディタ内から DB を見て SQL を実行（Prisma Studio の代わり） |
| `anthropic.claude-code`                 | VS Code から Claude Code を使う                               |
| `bierner.markdown-mermaid`              | この README の図（Mermaid）をプレビューで表示                 |

### 8-3. `launch.json`（デバッグ構成）

| 構成                                             | 内容                                                        |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `user/server` / `admin/server`                   | `tsx --inspect` で起動してブレークポイントで止められる      |
| `user/client (Chrome)` / `admin/client (Chrome)` | Chrome で画面を開き、Vue のコードにブレークポイントを置ける |
| `User Full Stack` / `Admin Full Stack`           | 該当アプリの server + client を同時に起動                   |
| `All`                                            | 4 つすべてを同時に起動                                      |

**理由**: `console.log` を差し込む代わりに、止めて中身を見るデバッグができる（不具合調査が速くなる）。

### 8-4. `tasks.json`（よく使う作業を 1 クリックで）

`dev` / `test` / `typecheck` / `db:migrate` / `db:codegen` / `lint`。
`problemMatcher`（`$tsc-watch` `$tsc` `$eslint-stylish`）を付けて、エラーが「問題」パネルに出てクリックで該当箇所へ移動できるようにしています。

---

## 9. その他の設定ファイルと、その理由

| ファイル                            | 内容                                                                                                                           | 理由                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `.editorconfig`                     | UTF-8・LF・インデント 2 スペース・末尾に改行。`*.ps1` のみ UTF-8 BOM + CRLF                                                    | エディタが違っても同じ書式にする。PowerShell 5.1 は BOM なしの日本語を読み違えるため                               |
| `.prettierrc`                       | `printWidth: 100`、`singleQuote`、`semi: false`、`trailingComma: all`、tailwind プラグイン（`cn` / `cva` のクラスも並べ替え）  | 見た目を機械に任せ、レビューで書式の議論をしない                                                                   |
| `.prettierignore`                   | 生成物・ロックファイル・マイグレーション・自動生成型・ログ                                                                     | 整形してはいけない／意味のないものを除外                                                                           |
| `eslint.config.mjs`                 | `@antfu/eslint-config`（stylistic は無効）。`.claude/` を対象外。`.mjs` の誤検知を回避する設定                                 | 整形は Prettier、ESLint は誤りの検出に専念させる。回避の理由は [troubleshooting](docs/troubleshooting.md)          |
| `tsconfig.base.json`                | `strict`、`noUncheckedIndexedAccess`、`verbatimModuleSyntax`、`isolatedModules`、`moduleResolution: Bundler`、`target: ES2023` | 厳しい型チェックでバグを早く見つける（配列の添字アクセスも `undefined` を考慮させる）。Vite / tsx と相性が良い設定 |
| `pnpm-workspace.yaml`               | `user/*` `admin/*` `packages/*` を同じワークスペースに。ビルドを許可する依存（`bcrypt` `esbuild`）を明示                       | pnpm 10 は安全のため、許可した依存だけがインストールスクリプトを実行できる                                         |
| `.husky/pre-commit` + `lint-staged` | コミット時に、変更したファイルへ Prettier と ESLint                                                                            | 崩れたコードをリポジトリに入れない                                                                                 |
| `.nvmrc`                            | `22`                                                                                                                           | Node のバージョンを揃える                                                                                          |
| `.env.example`                      | 環境変数の見本（DB 接続・JWT シークレット・ポート・オリジン）                                                                  | `.env`（秘密）は Git に入れず、見本だけ共有する                                                                    |
| `.gitignore`                        | `node_modules`・`.env*`（`.env.example` 以外）・`logs`・ビルド成果物・Claude の一時フラグ                                      | 秘密情報や生成物の誤コミットを防ぐ                                                                                 |
| `docker-compose.yml`                | PostgreSQL 16（postgres / test999 / xclone）                                                                                   | 誰でも同じ DB をすぐ用意できる（既存のローカル DB があれば不要）                                                   |
| `.github/PULL_REQUEST_TEMPLATE.md`  | PR の本文テンプレート                                                                                                          | 概要・テスト方法・更新漏れのチェックを毎回確認する                                                                 |
| `.github/ISSUE_TEMPLATE/`           | 不具合報告・機能要望                                                                                                           | 不具合報告に `requestId` などの手がかりを書かせ、AI が調査しやすくする                                             |

---

## 10. テストデータ

システムの動作確認には、**あらゆる状態を含むテストデータ** を必ず用意します（凍結ユーザー、削除済み投稿、対応状況の違う通報、空状態のユーザーなど）。

- 仕様: [`docs/test-data.md`](docs/test-data.md)（アカウント一覧・件数・確認シナリオ）
- 実装: `packages/db/seed.ts`（Phase 1 で作成）
- **何度実行しても同じ結果** になるように、固定の乱数シードと固定の基準日時を使います
- **機能を足したら seed と `docs/test-data.md` も必ず更新する** のがルールです（`/feature` の手順に組み込み済み）

---

## 11. 不具合が起きたとき（AI が調査しやすい仕組み）

```mermaid
flowchart LR
  A["不具合を見つける"] --> B["/debug 症状 を実行"]
  B --> C["bug-investigator が調査"]
  C --> D["ログ<br/>logs/*.log"]
  C --> E["DB の実データ<br/>postgres MCP"]
  C --> F["画面<br/>Playwright MCP"]
  C --> G["コードと履歴<br/>git log / blame"]
  D & E & F & G --> H["根本原因を特定"]
  H --> I["先に失敗するテストを書く"]
  I --> J["修正 → テストが通る"]
  J --> K["troubleshooting に記録"]
```

調査しやすくするための工夫:

| 工夫                     | 内容                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **構造化ログ**           | pino で 1 行 1 JSON を `logs/*.log` に出力。機械で検索しやすい                                         |
| **`requestId`**          | すべてのリクエストに ID を付け、全ログ行とエラー応答に含める。「このリクエストで何が起きたか」を追える |
| **安定したエラーコード** | `error.code`（例 `POST_NOT_FOUND`）で原因の種類を特定しやすい                                          |
| **調査コマンド**         | `pnpm logs:errors`（直近のエラー）/ `pnpm logs:trace <requestId>`（1 リクエストの全ログ）              |
| **DB を直接確認**        | postgres MCP で、実データ・制約・インデックス・`EXPLAIN` を確認できる                                  |
| **再現しやすいデータ**   | 固定のテストデータで同じ状況を再現できる                                                               |
| **手順書**               | skill `debugging` と、過去のつまずきの記録 [`docs/troubleshooting.md`](docs/troubleshooting.md)        |
| **Issue テンプレート**   | 症状・再現手順・`requestId` を書く欄がある                                                             |

> ログの出力（pino）と `requestId` の付与は Phase 3（user/server の土台）で実装します。規約は `.claude/rules/observability.md` に先に定めています。

---

## 12. 画面仕様書（Excel）

[`docs/screens/画面仕様書.xlsx`](docs/screens/画面仕様書.xlsx) に、**21 画面**（ユーザー 12 + 管理者 9）の仕様を作成済みです。

- 形式: **基本設計**（目的・画面構成・URL・認証・関連 API / テーブル）と **詳細設計**（項目定義・動作定義・状態ごとの表示・テスト観点）を、画面ごとの 1 枚にまとめました
- 共通のシート: 表紙・画面一覧・画面遷移・共通仕様・メッセージ一覧・用語集（合計 27 シート）
- **キャプチャ**: 画面は未実装のため「未取得」の枠が出ています。UI を実装したあと **`/screen-spec`** で、Playwright MCP が実画面を撮影して自動で貼り付けます（画像の自動貼り付けは動作確認済み）
- 元データ `docs/screens/specs/*.mjs` を編集して `pnpm spec:screens` で再生成します（Excel を手で直さない）

詳細: [`docs/screens/README.md`](docs/screens/README.md)

---

## 13. なぜこのように開発したのか（総括）

初心者の方にも分かるように、**この開発のやり方の「理由」** をまとめます。

### 13-1. なぜ「運用基盤（Phase 0）」を最初に作ったのか

アプリを作り始めてから規約や仕組みを後付けすると、すでに書いたコードがバラバラになり、直すコストが大きくなります。
**先に「ルール」「自動チェック」「手順書」を整えておけば、AI が書いたコードも最初から同じ品質** になります。

### 13-2. なぜ AI の指示を 4 層に分けたのか

AI に渡す指示（CLAUDE.md）が長いと、大事なことが埋もれて守られにくくなります。
そこで **常に必要なものだけを短く（100 行以内）** CLAUDE.md に置き、領域ごとの規約（rules）・手順書（skills）・定型作業（commands）は **必要なときだけ読み込まれる** ようにしました。

### 13-3. なぜ hooks（自動処理）を使うのか

「規約を守ってね」とお願いするだけでは、AI も人も見落とします。**hooks は必ず実行される** ので、整形・型チェックは自動で、危険な操作（全削除・強制 push・秘密情報や適用済みマイグレーションの編集）は仕組みでブロックします。

### 13-4. なぜ admin と user を分けたのか

管理者の機能は強い権限を持ちます。同じアプリに混ぜると、1 つの脆弱性が全体に波及します。**物理的に分ければ、事故の影響範囲を限定** できます。共通部分は `packages/` で共有するので、二重に書く必要もありません。

### 13-5. なぜ Prisma ではなく Kysely + SQL にしたのか

X のタイムラインや通知は、複数テーブルの結合・集計が中心で **性能がサービスの体験を左右** します。そこで、実行される SQL を自分で設計・チューニングできる構成にしました。
Kysely は SQL とほぼ同じ書き方で型もつくため、速さと安全性を両立できます。マイグレーションも素の SQL なので、インデックスなどの DB の機能をそのまま使えます（[ADR 0003](docs/adr/0003-kysely-and-sql-migrations.md)）。

### 13-6. なぜ読みやすさとコメントを重視するのか

コードは「書く」より「読む」時間のほうがずっと長く、後から来る人（人間でも AI でも）が理解できないと保守できません。
命名・関数の責務・日本語コメント（ファイルの役割・公開関数・「なぜ」）を **規約（`code-quality.md`）にして、レビューでも確認** しています。

### 13-7. なぜ記録（ADR・progress・roadmap・troubleshooting）を残すのか

コードを読んでも分からないのは「**なぜそうしたか**」です。担当者や AI が替わっても、**この記録を読めば再開できる** ようにしています。

| 記録                      | 残すもの                       |
| ------------------------- | ------------------------------ |
| `docs/adr/`               | 設計判断の理由・検討した選択肢 |
| `docs/roadmap.md`         | これからやること（タスク台帳） |
| `docs/progress.md`        | やったこと・判断・次の一手     |
| `docs/troubleshooting.md` | 実際に遭遇した問題と解決策     |
| `docs/test-data.md`       | 動作確認データの仕様           |

### 13-8. なぜテストデータを必ず用意するのか

画面や API を作っても、データが無ければ **動作を確認できません**。凍結ユーザーや空状態など「普段は出会わない状態」も含めて用意しておけば、確認も不具合の再現も、E2E テストも速くなります。

### 13-9. なぜ Phase に分けて、各 Phase で確認を取るのか

一度に全部作ると、間違った方向に進んでいても気づけません。**小さく作って確認する** ことで、手戻りを小さくします。AI が自走で進める範囲でも、「設計の大きな分岐」と「Phase の完了」は人が確認します。

### 13-10. 開発中に起きた問題と、その対処

実際に起きた問題は [`docs/troubleshooting.md`](docs/troubleshooting.md) に症状・原因・対処を記録しています。主なもの:

- **TypeScript 7.0 が ESLint で動かない** → TypeScript 5.9 に固定（[ADR 0007](docs/adr/0007-toolchain-version-pins.md)）
- **ESLint が `.mjs` で「型としてしか使われていない」と誤検知** → `.mjs` だけ該当ルールを無効化し、理由を設定ファイルに明記
- **`corepack enable` が管理者権限で失敗** → `npm i -g pnpm@10` を採用

---

## 14. 後継者のためのガイド

人間でも AI でも、**次の順番で読めば開発を再開できます**。

1. **この README** — 全体像・起動方法・理由
2. [`docs/progress.md`](docs/progress.md) — 現在地（一番上が最新）
3. [`docs/roadmap.md`](docs/roadmap.md) — 次にやること（最初の `[ ]`）
4. [`docs/adr/`](docs/adr/README.md) — なぜそう決めたか
5. [`CLAUDE.md`](CLAUDE.md) と `.claude/rules/` — 守るべき規約
6. [`docs/troubleshooting.md`](docs/troubleshooting.md) — 過去のつまずき

### 守ってほしいこと（変えるときは ADR を書く）

- `packages/shared` の Zod スキーマが **唯一の真実**（型を二重に書かない）
- admin と user のサーバーは **互いに呼ばない**
- DB の変更は **SQL マイグレーション** で行い、**適用済みのものは編集しない**
- 管理者の変更操作は **同一トランザクションで監査ログに記録** する
- 機能を足したら **seed・`docs/test-data.md`・`docs/progress.md`** を更新する
- CLAUDE.md は **100 行以内**。足したくなったら rules / skills / docs に置けないか先に考える

### 次の一手

Phase 2（`packages/shared` と `packages/ui`）: 定数・Zod スキーマ・DTO 型・Socket.IO のイベント型、デザイントークン（作成済み）・`cn()` / `cva()`・Button / Avatar / Dialog。
Claude Code で **`/next`** と入力すれば進められます（Phase の切り替わりでは、着手前にユーザーの承認を取る約束です）。

### 将来の機能（バックログ）

DM・リスト・ミュート/ブロック・投票・メール確認/2 要素認証・画像/動画アップロード基盤・全文検索の強化・おすすめの改善・多言語対応・キャッシュ・本番デプロイ。詳細は [`docs/roadmap.md`](docs/roadmap.md) の末尾。

---

## 15. 用語集（初心者向け）

| 用語                               | 意味                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| モノレポ                           | 複数のアプリを 1 つのリポジトリでまとめて管理すること                          |
| pnpm                               | Node.js のパッケージ管理ツール（npm の仲間。高速で、ディスクを節約できる）     |
| Vue / Pinia / Vite                 | 画面を作るフレームワーク / その状態管理 / 開発サーバーとビルドツール           |
| Express                            | Node.js の Web サーバーフレームワーク（API を作る）                            |
| Zod                                | 入力が正しい形かを検証するライブラリ（型も自動で作れる）                       |
| Kysely                             | SQL を TypeScript で型安全に書けるライブラリ                                   |
| マイグレーション                   | データベースの構造（テーブルなど）の変更を、順番つきのファイルで管理する仕組み |
| seed                               | 動作確認用のテストデータを DB に入れる処理                                     |
| JWT / access token / refresh token | ログイン状態を表すトークン。access は短命、refresh は長命で更新用              |
| httpOnly Cookie                    | JavaScript から読めない Cookie（盗まれにくい）                                 |
| bcrypt                             | パスワードを安全に保存するためのハッシュ化方式                                 |
| RBAC                               | ロール（役割）に応じて操作を許可する仕組み                                     |
| Socket.IO                          | サーバーから画面へリアルタイムに通知を送るための仕組み                         |
| N+1 問題                           | 一覧を取得してから 1 件ずつ追加でクエリを投げ、遅くなる問題                    |
| cursor ページネーション            | 「ここから後ろ」を指す目印で次のページを取る方式（件数が増えても速い）         |
| 楽観的更新                         | 結果を待たずに画面を先に更新し、失敗したら元に戻す方式                         |
| E2E テスト                         | 実際のブラウザで画面を操作して、全体の動作を確認するテスト                     |
| ADR                                | 設計判断の記録（Architecture Decision Record）                                 |
| hooks                              | 保存時やコマンド実行時などに **自動で動く処理**                                |
| MCP                                | AI が外部のツール（DB・ブラウザなど）を使うための仕組み                        |
| サブエージェント                   | 役割と権限を絞った AI の担当者                                                 |
| Conventional Commits               | `feat(scope): 内容` のように、コミットメッセージの書き方を揃える規約           |

---

## 16. 付録

- [GitHub CLI（gh）の使い方メモと、Claude Code 機能の整理（2 つの軸）](docs/notes/github-cli-and-claude-code-memo.md) — 以前の README の内容
- アーキテクチャ図は [2 章](#2-全体像完全理解マップ) を参照
- リモート: `origin` = https://github.com/choryoh3/claude-code-book-template.git、ブランチ `main`
