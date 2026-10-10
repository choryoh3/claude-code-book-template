---
paths: ['admin/**']
---

# 管理者アプリのセキュリティ規約

## 認証・認可

- 管理者は一般ユーザーと別の認証エンドポイント・別の JWT シークレットを使う
- 全ルートに `requireAdmin` を適用し、操作ごとに RBAC（ロール × 権限）で許可を判定する
- 一般ユーザーのトークンで admin API を叩けないこと（逆も同様）をテストで保証する
- ログイン失敗はレート制限し、エラー文言でアカウントの存在を漏らさない

## 監査ログ（必須）

管理者の変更系操作（凍結・解除・ロール変更・投稿の非表示/削除・通報対応）は、
**操作と同一トランザクションで** `AuditLog` を記録する。失敗したら操作もロールバックする。

```ts
// Good
await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { isSuspended: true } }),
  prisma.auditLog.create({ data: { adminId, action: 'USER_SUSPEND', targetId: id, detail } }),
])
// Bad: 操作後に別途ログを書く（ログ漏れが起きる）
```

- 記録項目: 実行者・操作種別・対象・変更内容・日時・IP
- パスワードやトークンなどの秘密値は記録しない

## その他

- 凍結・強制ログアウト時は該当ユーザーの refresh token を失効させる
- 自分自身のロール変更・凍結を禁止する。最後の admin を降格させない
- 入力は全て Zod で検証し、検索クエリは Prisma のパラメータ化に任せる（生 SQL 禁止）
- 管理画面でユーザー投稿を表示する際は XSS に注意し、`v-html` を使わない
