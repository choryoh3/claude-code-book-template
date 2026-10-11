import type { ClassValue } from 'clsx'
// クラス名を組み立てる関数 `cn()`。
// - clsx: 条件付きのクラスを書ける（cn('a', isActive && 'b')）
// - tailwind-merge: 後から渡したクラスで、競合する Tailwind のクラスを上書きする
//   （cn('px-2', 'px-4') は 'px-4' だけになる。コンポーネントの class を外から上書きできるようにするため）
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
