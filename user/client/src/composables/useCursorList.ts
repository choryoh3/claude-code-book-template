// cursor ページネーションの一覧（タイムライン・通知・プロフィールのタブ・検索結果など）を扱う composable。
//
// 使い方:
//   const list = useCursorList((cursor) => postApi.followingTimeline({ cursor }), (post) => post.id)
//   onMounted(list.reload)               // 1 ページ目を読む
//   <InfiniteScrollSentinel @visible="list.loadMore" />   // 末尾が見えたら続きを読む
//
// 画面に出す 3 つの状態（読み込み中 / エラー / 空）も、ここで持つ（画面仕様書の共通仕様）。

import { computed, ref, shallowRef } from 'vue'
import { errorMessage } from '@/api/client'

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export function useCursorList<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
  getKey: (item: T) => string,
) {
  /** 一覧（大きくなるので shallowRef。要素の差し替えは配列ごと入れ替える） */
  const items = shallowRef<T[]>([])
  const nextCursor = ref<string | null>(null)
  const isLoading = ref(false)
  const errorText = ref<string | null>(null)
  /** 1 回以上読み込みが終わったか（「まだ読んでいない」と「0 件だった」を区別するため） */
  const isLoaded = ref(false)
  /** 読み込みのたびに増やす番号。古い読み込みの結果が、新しい結果を上書きしないようにする */
  let generation = 0

  const hasMore = computed(() => nextCursor.value !== null)
  const isEmpty = computed(
    () => isLoaded.value && !isLoading.value && items.value.length === 0 && !errorText.value,
  )

  async function load(cursor: string | undefined, append: boolean) {
    const current = ++generation
    isLoading.value = true
    errorText.value = null
    try {
      const page = await fetchPage(cursor)
      if (current !== generation) return // 途中で reload されたら、この結果は捨てる
      // 次のページの先頭が、すでに表示している投稿と重なっても二重に出さない
      const seen = new Set(append ? items.value.map(getKey) : [])
      const fresh = page.items.filter((item) => !seen.has(getKey(item)))
      items.value = append ? [...items.value, ...fresh] : fresh
      nextCursor.value = page.nextCursor
      isLoaded.value = true
    } catch (error) {
      if (current === generation) errorText.value = errorMessage(error)
    } finally {
      if (current === generation) isLoading.value = false
    }
  }

  /** 1 ページ目から読み直す（タブの切り替え・画面を開いたとき） */
  function reload() {
    nextCursor.value = null
    return load(undefined, false)
  }

  /** 続きを読む（読み込み中・最後のページ・エラー中は何もしない） */
  function loadMore() {
    if (isLoading.value || !hasMore.value || errorText.value) return Promise.resolve()
    return load(nextCursor.value ?? undefined, true)
  }

  /** 失敗したところから、もう一度読む（「再試行」ボタン） */
  function retry() {
    return isLoaded.value ? load(nextCursor.value ?? undefined, true) : reload()
  }

  /** 1 件を置き換える（いいね等で更新されたとき） */
  function replace(updated: T) {
    const key = getKey(updated)
    items.value = items.value.map((item) => (getKey(item) === key ? updated : item))
  }

  /** 1 件を取り除く（削除したとき） */
  function remove(key: string) {
    items.value = items.value.filter((item) => getKey(item) !== key)
  }

  /** 先頭に足す（自分が投稿したとき・新しい通知が届いたとき） */
  function prepend(newItems: T[]) {
    const keys = new Set(newItems.map(getKey))
    items.value = [...newItems, ...items.value.filter((item) => !keys.has(getKey(item)))]
  }

  /** 末尾に足す（古い順の一覧＝リプライに、自分の返信を足すとき） */
  function append(newItems: T[]) {
    const keys = new Set(newItems.map(getKey))
    items.value = [...items.value.filter((item) => !keys.has(getKey(item))), ...newItems]
  }

  /**
   * 全件に変換をかける（例: 同じ投稿が「本人の投稿」と「リポスト」で 2 回並んでいるとき、両方を更新する）
   */
  function mapItems(transform: (item: T) => T) {
    items.value = items.value.map(transform)
  }

  /** 条件に合うものだけを残す（例: 削除した投稿を、リポストの分も含めて取り除く） */
  function filterItems(keep: (item: T) => boolean) {
    items.value = items.value.filter(keep)
  }

  return {
    append,
    mapItems,
    filterItems,
    items,
    isLoading,
    errorText,
    isLoaded,
    hasMore,
    isEmpty,
    reload,
    loadMore,
    retry,
    replace,
    remove,
    prepend,
  }
}
