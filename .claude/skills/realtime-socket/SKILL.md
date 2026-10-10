---
name: realtime-socket
description: Socket.IO のリアルタイム機能（通知など）を追加・変更する手順。イベントの型定義を shared に置く方法、認証ミドルウェア、room 設計、クライアント側の購読を扱う。「リアルタイム通知」「WebSocket」「Socket.IO のイベントを追加」といった依頼で使う。
---

# Socket.IO イベント追加の手順

## 設計の約束

- **イベント名と payload の型は `packages/shared/src/socket.ts` にだけ定義**する。client / server は同じ型で `Server<ClientToServer, ServerToClient>` / `Socket<...>` を作る
- 接続時に **認証ミドルウェア**（`io.use`）で access token を検証し、`socket.data.userId` に保存。未認証は接続拒否
- **room は `user:<userId>`** を基本とする。接続時に自分の room へ join し、通知はその room へ emit する（複数タブ・複数端末でも届く）
- DB 保存が先、emit が後。取りこぼしても再読み込み時に通知一覧 API で復元できるようにする
- admin と user のサーバーは別プロセス。互いのソケットへ直接 emit しない（必要なら DB 経由）

## 手順

1. `shared/src/socket.ts` にイベント名（定数）と payload の Zod スキーマ/型を追加
2. server: 通知を作る service 内で、DB 保存後に `io.to(\`user:\${recipientId}\`).emit(...)`
3. client: `src/composables/useSocket.ts` で接続を 1 つだけ管理し、store が購読する
4. ログアウト時は `socket.disconnect()`、token 更新時は再接続
5. テスト: `socket.io-client` で接続し、未認証が拒否されること・自分宛の通知だけ届くことを検証

## 落とし穴

- 自分自身の操作（自分の投稿にいいね）では通知しない
- ブラウザのタブが非表示でも切断されうる。再接続時に未読件数 API を再取得する
