---
paths: ['**/*.ts', '**/*.vue', '**/*.mjs']
---

# 可読性・保守性の規約

読む人が迷わないコードを最優先する。短さや技巧より、意図の明快さを選ぶ。

## 命名

- 名前は「何であるか / 何をするか」を表す。`data` `tmp` `handle` `info` は避ける
- 真偽値は `is` / `has` / `can` で始める。関数は動詞で始める（`fetchTimeline`、`toPostDto`）
- 略語は一般的なもの（`id`, `url`）のみ

```ts
// Good
const isOwnPost = post.authorId === currentUser.id
// Bad
const flag = post.authorId === currentUser.id
```

## 関数

- 1 関数 1 責務。目安は 30 行以内、引数 3 つ以内（超えるならオブジェクト引数）
- ネストは早期 return で浅くする（深さ 3 以内）
- 副作用のある処理と純粋な計算は分ける

```ts
// Good
if (!post) throw new NotFoundError('post')
if (post.isDeleted) return null
return toPostDto(post)
// Bad: if (post) { if (!post.isDeleted) { ... } }
```

## 型・定数

- `any` 禁止。不明な値は `unknown` + Zod で絞り込む
- 魔法の数値・文字列は名前付き定数にする（`MAX_POST_LENGTH = 280` は `packages/shared`）
- `as` による型アサーションは最後の手段。理由をコメントで残す

## コメント

わかりやすい日本語のコメントを積極的に書く。初見の人が全体像と意図をつかめることを目標にする。

- ファイル先頭に「このファイルの役割」を 1〜2 行で書く
- export する関数・クラス・store・composable には JSDoc で「何をするか・引数・戻り値・注意点」を書く
- 処理のかたまりごとに、見出しとなる短いコメントを付ける（`// 1. 入力を検証する`）
- 「なぜそうするのか」（仕様上の理由・落とし穴・回避策）は必ず書く
- コメントはコードと同時に更新する。古いコメントは無いより有害
- コードを言い換えただけのコメント（`// i を 1 増やす`）は書かない。分かりにくければ名前を直す
- TODO は `// TODO(理由): ...` の形で残す。放置しない

```ts
/**
 * 投稿を作成する。
 * 本文中のハッシュタグとメンションを抽出し、通知の対象にする。
 */
export async function createPost(authorId: string, input: CreatePostInput) {
  // 1. ハッシュタグを抽出する（検索・トレンド集計で使う）
  const hashtags = extractHashtags(input.content)
  // ...
}
```

## 構造

- ファイルは 1 つの役割（目安 300 行以内）。超えたら分割する
- 重複は 3 回目で抽出する。早すぎる抽象化はしない
- 使われていないコード・コメントアウトは削除する（履歴は Git にある）
