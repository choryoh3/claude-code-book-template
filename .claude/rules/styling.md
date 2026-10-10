---
paths: ['**/*.vue', 'packages/ui/**', '**/*.css']
---

# スタイリング規約（Tailwind CSS v4）

## デザイントークン

- 色・余白・角丸・フォントは `packages/ui/src/tokens.css` の CSS 変数で定義し、`@theme` で Tailwind に公開する
- 色は意味ベースの名前（`--color-surface`, `--color-text-muted`, `--color-accent`）。`--color-blue-500` を直接使わない
- ダークモードはトークン側で切り替える（`.dark` でトークンを上書き）。各コンポーネントに `dark:` を散在させない

```vue
<!-- Good: トークン経由なのでテーマに追従 -->
<div class="bg-surface text-text border-border">
<!-- Bad: 固定色 -->
<div class="bg-[#15202b] text-white">
```

## クラスの書き方

- 条件付き・バリアントは `cn()`（clsx + tailwind-merge）と `cva()` を使う
- 同じクラスの組み合わせが 3 回出たらコンポーネント化する（`@apply` は原則使わない）
- 任意値 `[...]` は最終手段。必要ならトークンを追加する
- クラス順は `prettier-plugin-tailwindcss` が自動整列する（手で並べない）

## コンポーネント

- 共通 UI は `packages/ui`。アプリ固有の見た目は各 client に置く
- アクセシビリティ: ボタンは `<button>`、画像に `alt`、フォーカスリングを消さない、
  ダイアログ等は Radix Vue のプリミティブを使う
- アイコンは lucide-vue-next のみ

## 禁止

- `<style>` での大量の独自 CSS、`!important`、インライン `style`（動的な値を除く）
