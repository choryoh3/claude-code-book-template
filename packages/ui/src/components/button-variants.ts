// ボタンの見た目のバリエーション（cva で定義）。Button.vue が使う。
// 色は意味のある名前のトークン（bg-accent など）を使う。固定色は使わない（ダークモードに追従するため）。

import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  // 共通: 角丸・太字・フォーカスリング（キーボード操作で見えるように消さない）・非活性の見た目
  'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        /** 主な操作（投稿する・ログインなど） */
        primary: 'bg-accent text-white hover:bg-accent/90',
        /** 補助的な操作（輪郭だけ） */
        secondary: 'border border-border bg-transparent text-text hover:bg-surface-hover',
        /** 目立たせない操作（アイコンボタンなど） */
        ghost: 'bg-transparent text-text hover:bg-surface-hover',
        /** 取り消せない・危険な操作（削除・凍結など） */
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-5 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
