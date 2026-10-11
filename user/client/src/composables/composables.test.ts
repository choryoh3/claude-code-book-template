import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '@/stores/toast'
import { errorResponse, jsonResponse, makePost } from '@/test/fixtures'
import { useCursorList } from './useCursorList'
import { toggledPost, usePostActions } from './usePostActions'

describe('useCursorList', () => {
  /** 1 ページ 2 件の、数字の一覧を返すダミーの API */
  function fakeApi(total: number) {
    return vi.fn(async (cursor: string | undefined) => {
      const start = cursor ? Number(cursor) : 0
      const items = Array.from({ length: Math.min(2, total - start) }, (_, i) => ({
        id: String(start + i),
      }))
      return { items, nextCursor: start + 2 < total ? String(start + 2) : null }
    })
  }

  it('reload で 1 ページ目、loadMore で続きを読み、最後のページで hasMore が false になる', async () => {
    const list = useCursorList(fakeApi(3), (item) => item.id)

    await list.reload()
    expect(list.items.value.map((item) => item.id)).toEqual(['0', '1'])
    expect(list.hasMore.value).toBe(true)

    await list.loadMore()
    expect(list.items.value.map((item) => item.id)).toEqual(['0', '1', '2'])
    expect(list.hasMore.value).toBe(false)
  })

  it('最後のページのあとに loadMore しても、API を呼ばない', async () => {
    const api = fakeApi(2)
    const list = useCursorList(api, (item) => item.id)
    await list.reload()

    await list.loadMore()

    expect(api).toHaveBeenCalledTimes(1)
  })

  it('0 件なら isEmpty が true になる（「まだ投稿がありません」の表示）', async () => {
    const list = useCursorList(fakeApi(0), (item) => item.id)
    expect(list.isEmpty.value).toBe(false) // 読み込む前は「空」とは言わない

    await list.reload()

    expect(list.isEmpty.value).toBe(true)
  })

  it('失敗したらエラーの文言を持ち、retry で読み直せる', async () => {
    const api = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: null })
    const list = useCursorList<{ id: string }>(api, (item) => item.id)

    await list.reload()
    expect(list.errorText.value).toBe('読み込みに失敗しました。時間をおいて再度お試しください')

    await list.retry()
    expect(list.errorText.value).toBeNull()
    expect(list.items.value).toEqual([{ id: 'a' }])
  })

  it('次のページに、表示済みと同じものが含まれていても二重に出さない', async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'x' })
      .mockResolvedValueOnce({ items: [{ id: 'b' }, { id: 'c' }], nextCursor: null })
    const list = useCursorList<{ id: string }>(api, (item) => item.id)

    await list.reload()
    await list.loadMore()

    expect(list.items.value.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('prepend は先頭に足し、同じものがあれば古い方を消す', async () => {
    const list = useCursorList(fakeApi(2), (item) => item.id)
    await list.reload()

    list.prepend([{ id: '1' }])

    expect(list.items.value.map((item) => item.id)).toEqual(['1', '0'])
  })
})

describe('usePostActions（楽観的更新）', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('toggledPost: いいねを付けると liked が true になり、件数が 1 増える（外すと戻る）', () => {
    const liked = toggledPost(makePost({ likeCount: 3 }), 'like')
    expect(liked).toMatchObject({ liked: true, likeCount: 4 })
    expect(toggledPost(liked, 'like')).toMatchObject({ liked: false, likeCount: 3 })
  })

  it('押した瞬間に画面を変え、成功したらサーバーの値で上書きする', async () => {
    const post = makePost({ likeCount: 1 })
    fetchMock.mockResolvedValue(jsonResponse({ ...post, liked: true, likeCount: 5 }))
    const changes: unknown[] = []
    const actions = usePostActions((updated) => changes.push(updated))

    await actions.toggleLike(post)

    expect(changes[0]).toMatchObject({ liked: true, likeCount: 2 }) // 1. 先に画面を変える
    expect(changes[1]).toMatchObject({ liked: true, likeCount: 5 }) // 2. サーバーの値
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`/api/posts/${post.id}/like`)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
  })

  it('失敗したら元に戻し、エラーのトーストを出す', async () => {
    const post = makePost({ bookmarked: true })
    fetchMock.mockResolvedValue(errorResponse(404, 'POST_NOT_FOUND', 'この投稿は存在しません'))
    const changes: unknown[] = []
    const actions = usePostActions((updated) => changes.push(updated))

    await actions.toggleBookmark(post)

    expect(changes.at(-1)).toEqual(post) // 元の状態に戻る
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE') // ブックマーク済み → 外す
    expect(useToastStore().toasts[0]).toMatchObject({
      kind: 'error',
      message: 'この投稿は存在しません',
    })
  })

  it('一覧に出ている「○○さんがリポストしました」は、サーバーの値で上書きしても消さない', async () => {
    const post = makePost({
      repostedBy: { id: 'u', handle: 'carol', displayName: 'Carol', avatarUrl: null },
    })
    fetchMock.mockResolvedValue(
      jsonResponse({ ...post, repostedBy: null, liked: true, likeCount: 1 }),
    )
    const changes: { repostedBy: unknown }[] = []
    const actions = usePostActions((updated) => changes.push(updated))

    await actions.toggleLike(post)

    expect(changes.at(-1)?.repostedBy).toEqual(post.repostedBy)
  })
})
