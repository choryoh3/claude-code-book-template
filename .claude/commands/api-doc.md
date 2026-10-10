---
description: ルート定義と shared のスキーマから docs/api/ の API 一覧を再生成する
---

`docs/api/` の API ドキュメントを最新のコードから再生成してください。

1. `user/server/src/routes/` と `admin/server/src/routes/` を読み、全エンドポイントを列挙する
2. 各エンドポイントについて、`packages/shared` のスキーマから入出力の型を調べる
3. 次の形式で `docs/api/user.md` と `docs/api/admin.md` を書く（手書きの説明は上書きせず保持する）

   ```markdown
   ### POST /posts — 投稿を作成する

   - 認証: 必要（user）
   - リクエスト: `{ content: string(1〜280), mediaUrls?: string[](最大4) }`
   - レスポンス: 201 `PostDto` / 400 検証エラー / 401 未認証
   ```

4. 前回との差分（追加・変更・削除されたエンドポイント）を最後に要約して報告する
5. 実装とドキュメントが食い違っている箇所があれば指摘する
