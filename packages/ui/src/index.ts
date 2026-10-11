// @xclone/ui の入口。user / admin のアプリは、ここから部品を import する。
//   import { Button, Avatar, Dialog, cn } from '@xclone/ui'
// デザイントークン（色など）は CSS 側で読み込む:  @import '@xclone/ui/tokens.css';
export { default as Avatar } from './components/Avatar.vue'
export { buttonVariants } from './components/button-variants'
export type { ButtonVariants } from './components/button-variants'
export { default as Button } from './components/Button.vue'
export { default as Dialog } from './components/Dialog.vue'
export { cn } from './lib/cn'
