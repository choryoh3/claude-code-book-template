---
name: api-endpoint
description: Express サーバー（user/server または admin/server）に API エンドポイントを追加する定石。shared の Zod スキーマ、service、controller、route、Supertest テストの順序とテンプレートを提供する。「API を追加」「エンドポイントを作る」「REST ルートを実装」といった依頼で使う。
---

# API エンドポイント追加の手順

## 手順

1. **契約（`packages/shared`）**: 入力 `xxxSchema` と出力 DTO を `schemas/` に追加し、`index.ts` から export
2. **service**（`src/services/<feature>.service.ts`）: ビジネスロジック。Express に依存しない純粋な関数
   - DB 変更が複数テーブルに及ぶなら `prisma.$transaction`
   - admin の変更系は同一トランザクションで AuditLog を記録（`admin-security` rule）
3. **controller**（`src/controllers/<feature>.controller.ts`）: Zod で検証 → service 呼び出し → DTO 変換 → レスポンス
4. **route**（`src/routes/<feature>.routes.ts`）: HTTP メソッド・パス・認証/権限ミドルウェアの対応づけ
5. ルートを `src/routes/index.ts` に登録
6. **Supertest テスト**: 正常系・バリデーションエラー(400)・未認証(401)・権限なし(403)・存在しない(404)
7. `/api-doc` で `docs/api/` を更新
8. `pnpm typecheck && pnpm lint && pnpm test`

## 設計の約束

- パスは複数形のリソース名（`/posts`, `/posts/:id/likes`）。動詞は HTTP メソッドで表す
- 成功: 作成 201 / 取得・更新 200 / 削除 204。エラーは `{ error: { code, message } }` の統一形式
- 一覧は cursor ページネーション（`?cursor=&limit=`）。レスポンスに `nextCursor` を含める
- Prisma のモデルをそのまま返さない。必ず DTO に変換する

## テンプレート

`templates/controller.ts` を雛形として使う。
