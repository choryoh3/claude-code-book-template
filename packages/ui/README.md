# @xclone/ui — デザイントークンと共通部品

`user` と `admin` で共有する **見た目の部品** です。

```
packages/ui/src/
├── index.ts               # 入口（Button・Avatar・Dialog・cn を export）
├── tokens.css             # デザイントークン（色・角丸）。ライト / ダーク（.dark）の定義
├── lib/cn.ts              # クラス名の合成（clsx + tailwind-merge）
└── components/
    ├── Button.vue         # ボタン（primary / secondary / ghost / danger、処理中のスピナー）
    ├── Avatar.vue         # ユーザーのアイコン（画像が無いときは頭文字）
    ├── Dialog.vue         # モーダルダイアログ（Radix Vue でアクセシビリティを担保）
    └── button-variants.ts # ボタンの見た目の定義（cva）
```

## アプリ側での使い方（Phase 4 / 6 で各 client に設定する）

```css
/* アプリの CSS（例: user/client/src/style.css） */
@import '@xclone/ui/tokens.css';
```

```vue
<script setup lang="ts">
import { Avatar, Button, Dialog } from '@xclone/ui'
</script>

<template>
  <Avatar src="https://example.com/a.png" name="Alice" />
  <Button variant="primary" :loading="isSending" @click="send">投稿する</Button>
  <Dialog v-model:open="isOpen" title="通報する" description="理由を選んでください">
    ...
    <template #footer><Button variant="danger">送信</Button></template>
  </Dialog>
</template>
```

ダークモードは、`<html class="dark">` にするだけでトークンが切り替わります（各部品に `dark:` を書く必要はありません）。

## コマンド（`pnpm --filter "@xclone/ui" <コマンド>`）

| コマンド    | 内容                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `test`      | コンポーネントのテスト（Vitest + happy-dom）                                                        |
| `typecheck` | 型チェック（vue-tsc。`.vue` の中も検査する）                                                        |
| `css:build` | Tailwind を実際にビルドして、トークンと部品のクラスが生成されるか確認（出力は `dist/`・Git 管理外） |

## 守ること

- 色は **意味のある名前のトークン**（`bg-surface` `text-text-muted` `bg-accent` など）を使う。固定色（`bg-[#15202b]`）は使わない
- 新しい部品は、アクセシビリティ（`<button>`・`alt`・フォーカスリング・`aria-*`）を守り、テストを書く
- 規約: `.claude/rules/styling.md` ／ 設計の理由: [ADR 0005](../../docs/adr/0005-tailwind-v4-and-design-tokens.md)・[ADR 0008](../../docs/adr/0008-shared-and-ui-package-choices.md)
