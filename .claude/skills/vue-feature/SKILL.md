---
name: vue-feature
description: Vue クライアント（user/client または admin/client）に新しい画面・機能を追加するときの定石。ルート追加、ページ作成、composable、Pinia store、API クライアント、テストまでの順序とテンプレートを提供する。「画面を追加」「ページを作る」「クライアント側の機能を実装」といった依頼で使う。
---

# Vue 機能追加の手順

新機能は **外側（契約）から内側（UI）へ** 作る。各ステップで動作確認できる単位に分ける。

## 手順

1. **契約を確認**: 必要な API の入出力スキーマが `packages/shared` にあるか確認。無ければ先に `api-endpoint` skill で追加
2. **API クライアント**（`src/api/<feature>.ts`）: 型付き fetch ラッパー。型は `@xclone/shared` から import
3. **Pinia store**（`src/stores/<feature>.ts`）: setup store 形式。取得・更新の action と `computed` の派生値
4. **composable**（`src/composables/use<Feature>.ts`）: 画面横断で使うロジック（無限スクロール、フォームなど）
5. **コンポーネント**（`src/components/`）: 表示専念。props / emits を型付きで宣言
6. **ページ**（`src/pages/<Feature>Page.vue`）: store と composable を組み立てる
7. **ルート**（`src/router/index.ts`）: 遅延 import（`() => import(...)`）で追加。認証が必要なら meta を設定
8. **テスト**: store / composable は Vitest、コンポーネントは Vue Test Utils。主要導線は E2E（`e2e-playwright` skill）
9. `pnpm typecheck && pnpm lint && pnpm test` を通す

## テンプレート

`templates/store.ts` と `templates/Page.vue` を雛形として使う。コピー後、名前と型を置き換える。

## チェックリスト

- [ ] ロジックがコンポーネントに混ざっていない
- [ ] ローディング・エラー・空状態の 3 つを表示している
- [ ] キーボード操作とスクリーンリーダー向けの属性（`aria-*`, `alt`）がある
- [ ] コメントで「このファイルの役割」と「なぜ」を説明している
