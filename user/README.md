# user/ — 一般ユーザーアプリ

X を使う **一般ユーザー向け** のアプリです。

| フォルダ  | 役割                                                               | ポート |
| --------- | ------------------------------------------------------------------ | ------ |
| `client/` | 画面（Vue 3 + Vite）。タイムライン・投稿・プロフィール・通知・検索 | 5173   |
| `server/` | API（Express 5 + Socket.IO）。認証・投稿・フォロー・通知・検索     | 3000   |

- 実装は Phase 3（server）と Phase 4（client）。現在は空です（`docs/roadmap.md`）
- 管理者の機能は `../admin/` にあります。**このアプリから admin の API を呼ばないでください**
- `client` の中の構成は `.claude/rules/vue-client.md`、`server` は `.claude/rules/express-server.md` を参照
