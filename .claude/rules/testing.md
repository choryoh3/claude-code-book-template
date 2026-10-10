---
paths: ['**/*.test.ts', '**/*.spec.ts', 'e2e/**']
---

# テスト規約

## 配置と種類

| 種類           | ツール                  | 配置                           |
| -------------- | ----------------------- | ------------------------------ |
| 単体           | Vitest                  | 対象と同じ階層に `xxx.test.ts` |
| コンポーネント | Vitest + Vue Test Utils | `xxx.test.ts`                  |
| API            | Vitest + Supertest      | `server/src/**/*.test.ts`      |
| E2E            | Playwright              | `e2e/`（Page Object を使う）   |

## 書き方

- `describe` = 対象、`it` = 「〜のとき〜する」の日本語文で振る舞いを書く
- 1 テスト 1 関心事。Arrange / Act / Assert を空行で区切る
- 実装の内部ではなく、公開された振る舞い（戻り値・HTTP レスポンス・画面表示）を検証する
- テスト間でデータを共有しない。各テストが自分で前提を作る
- テスト用 DB は本番・開発 DB と分け、テストごとにクリーンにする

```ts
// Good
it('280文字を超える投稿は 400 を返す', async () => {
  const res = await request(app)
    .post('/posts')
    .send({ content: 'a'.repeat(281) })
  expect(res.status).toBe(400)
})

// Bad: it('test1', ...) / 実装の private 関数を直接検証
```

## E2E

- セレクタは `getByRole` / `getByLabel` / `data-testid` を優先（CSS クラスに依存しない）
- 固定 `waitForTimeout` 禁止。Playwright の自動待機・`expect` を使う
- 失敗テストは握りつぶさず原因を直す。`skip` / `only` をコミットしない
