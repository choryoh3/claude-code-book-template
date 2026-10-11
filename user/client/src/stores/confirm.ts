// 確認ダイアログ（「この投稿を削除しますか？」など）の store。
// ブラウザ標準の confirm() は見た目を変えられず、画面と雰囲気が合わないので、自前のダイアログを使う。
//
// 使い方（押されたボタンが Promise で返る）:
//   const confirm = useConfirmStore()
//   if (!(await confirm.ask({ title: '削除しますか？', confirmLabel: '削除', danger: true }))) return

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmRequest {
  title: string
  message?: string
  /** 実行するボタンの文言（例「削除」） */
  confirmLabel: string
  /** 取り消せない操作なら true（ボタンを赤くする） */
  danger?: boolean
}

export const useConfirmStore = defineStore('confirm', () => {
  const request = ref<ConfirmRequest | null>(null)
  let resolveAnswer: ((answer: boolean) => void) | null = null

  /** 確認ダイアログを開き、「実行」なら true、「キャンセル」・閉じたら false を返す */
  function ask(next: ConfirmRequest): Promise<boolean> {
    resolveAnswer?.(false) // 前の確認が開いたままなら、キャンセル扱いにする
    request.value = next
    return new Promise((resolve) => {
      resolveAnswer = resolve
    })
  }

  /** ダイアログのボタンが押されたとき */
  function answer(value: boolean) {
    resolveAnswer?.(value)
    resolveAnswer = null
    request.value = null
  }

  return { request, ask, answer }
})
