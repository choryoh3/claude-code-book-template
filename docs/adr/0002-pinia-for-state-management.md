# 0002. 状態管理に Pinia を使う（Redux Toolkit は使わない）

- ステータス: 採用
- 日付: 2026-10-11

## 背景

ログイン状態、タイムライン、通知など、複数の画面で共有する状態を管理する仕組みが必要。

## 検討した選択肢

1. **Redux Toolkit** — React で標準的に使われる。Vue でも技術的には使えるが、Vue のリアクティブな仕組み（`ref` / `computed`）と噛み合わず、記述が増える
2. **Vuex** — Vue 向けの旧来の標準。現在は保守モードで、新規採用は非推奨
3. **Pinia** — Vue 公式が推奨する後継。TypeScript の型推論が強く、`<script setup>` の書き方と自然に揃う

## 決定

**Pinia** を採用する。Redux Toolkit は React 向けのライブラリで、Vue ではその利点（React との統合）が得られず、Vue 公式の状態管理である Pinia のほうが記述量が少なく型も安全なため。
store は setup 形式（`defineStore('x', () => { ... })`）で書く。

## 結果

- 良い点: コードが短く読みやすい。Vue Devtools で状態を追える。テストしやすい
- 注意点: 状態を二重に持たない（派生値は `computed`）。サーバーとのやり取りは store の action に集約する（`.claude/rules/vue-client.md`）
