# @xclone/user-client — 一般ユーザー向けの画面

X（旧 Twitter）の画面を再現した Vue 3 のアプリです（ポート 5173）。API は `user/server`（ポート 3000）を使います。
画面の仕様は `docs/screens/specs/user-screens.mjs`（U-01〜U-12）と skill `x-ui-patterns`、規約は `.claude/rules/vue-client.md`・`styling.md`。

## 起動のしかた

```powershell
# 1. 先に API サーバー（user/server）と DB を起動しておく（README の 3 章）
pnpm --filter ./user/server dev

# 2. 別のターミナルで画面を起動
pnpm --filter "@xclone/user-client" dev
# → http://localhost:5173 を開き、テストデータのアカウント（alice@example.com / Password#123 など）でログイン
```

開発中は Vite が `/api`・`/uploads`・`/socket.io` を `http://localhost:3000` へ転送します（`vite.config.ts`）。
画面と API が同じオリジンに見えるので、refresh token の Cookie がそのまま使え、CORS の設定も要りません。

| コマンド（`pnpm --filter "@xclone/user-client" <コマンド>`） | 内容                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `dev`                                                        | 開発サーバー（保存すると即反映）                                         |
| `build`                                                      | 型チェック + 本番用のビルド（`dist/`）                                   |
| `typecheck`                                                  | 型チェック（vue-tsc。`.vue` の中も検査）                                 |
| `test`                                                       | 単体テスト（Vitest + Vue Test Utils + happy-dom。API は fetch をモック） |

## フォルダ構成

```
src/
├── main.ts / App.vue      # 起動・外枠（ログイン画面は枠なし、それ以外は 3 カラム）
├── router/                # URL とページの対応。ログイン状態の確認（authGuard）
├── api/
│   ├── client.ts          # fetch の土台: トークンの付与・401 で refresh を 1 回だけ再試行・応答の検証
│   ├── endpoints.ts       # API を 1 つずつ関数にしたもの（応答は shared の Zod スキーマで検証）
├── stores/                # Pinia（setup store）
│   ├── auth.ts            # ログイン状態。access token はメモリだけ（localStorage に保存しない）
│   ├── notifications.ts   # 未読件数・リアルタイムに届いた通知
│   ├── ui.ts              # 投稿・通報ダイアログの開閉
│   ├── confirm.ts         # 確認ダイアログ（「削除しますか？」）
│   ├── toast.ts / theme.ts
├── composables/
│   ├── useCursorList.ts   # cursor ページネーションの一覧（読み込み中・エラー・空・続き）
│   ├── usePostList.ts     # 投稿の一覧用（同じ投稿の「本人の投稿」と「リポスト」を別の行として扱う）
│   ├── usePostActions.ts  # いいね・リポスト・ブックマーク（楽観的更新）
│   └── useRealtime.ts     # Socket.IO（通知のリアルタイム受信）
├── lib/                   # 本文の部品分け（リンク化）・日時と件数の表示
├── components/
│   ├── layout/            # 左ナビ・右サイドバー・スマホの下部タブバー・3 カラム
│   ├── post/              # 投稿カード・本文・画像・引用・投稿フォーム・文字数カウンタ・一覧
│   ├── user/ notification/ report/ common/
├── pages/                 # ルート単位の画面（ログイン・登録・ホーム・投稿詳細・プロフィールなど）
└── test/fixtures.ts       # テスト用のサンプルデータ・テスト用ルーター
```

## 作りの決まりごと（なぜそうしたか）

- **access token はメモリ（Pinia）だけ**。再読み込み時は起動時に `/api/auth/refresh`（httpOnly Cookie）で取り直す（ADR 0004）
- **401 のときは refresh を 1 回だけ**試して送り直す。同時に何本 401 になっても refresh の通信は 1 回にまとめる
- **楽観的更新**: いいね等は押した瞬間に画面を変え、失敗したら元に戻してトーストで知らせる
- **本文は v-html を使わない**。部品（文字・ハッシュタグ・メンション・URL）に分けて描画関数で表示する（XSS 対策。テンプレートの改行が本文の空白として出る問題も防ぐ。`components/post/PostContent.ts` のコメント参照）
- **入力の検証はサーバーと同じ** shared の Zod スキーマで、送る前に行う
- **ダークモード**は `<html class="dark">` を付け外しするだけ（色は `packages/ui/src/tokens.css`）。`index.html` で描画前にテーマを当て、ちらつきを防ぐ
- 一覧の **3 つの状態（読み込み中・エラー・空）** を必ず出す（`components/common/ListStatus.vue`）
