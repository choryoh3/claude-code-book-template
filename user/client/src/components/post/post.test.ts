import { flushPromises, mount } from '@vue/test-utils'
import { MAX_POST_LENGTH } from '@xclone/shared'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  ALICE,
  BOB,
  createTestRouter,
  jsonResponse,
  makeAuthResponse,
  makePost,
} from '@/test/fixtures'
import CharCounter from './CharCounter.vue'
import PostCard from './PostCard.vue'
import PostComposer from './PostComposer.vue'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

/** Pinia（今の状態）とテスト用のルーターを入れて表示する */
function mountWithApp<T>(component: T, props: Record<string, unknown> = {}) {
  // コンポーネントごとに props の型が違うので、このテスト用の補助関数では型の検査を外す
  return mount(component as never, {
    props: props as never,
    global: { plugins: [createTestRouter()], stubs: { teleport: true } },
  })
}

describe('charCounter', () => {
  it.each([
    [100, 'normal'],
    [MAX_POST_LENGTH - 20, 'warning'],
    [MAX_POST_LENGTH + 1, 'over'],
  ])('%i 文字のときは %s の表示', (count, state) => {
    const wrapper = mount(CharCounter, { props: { count, max: MAX_POST_LENGTH } })
    expect(wrapper.attributes('data-state')).toBe(state)
  })

  it('上限を超えたら、超えた文字数をマイナスで出す', () => {
    const wrapper = mount(CharCounter, {
      props: { count: MAX_POST_LENGTH + 3, max: MAX_POST_LENGTH },
    })
    expect(wrapper.text()).toContain('-3')
  })
})

describe('postCard', () => {
  it('投稿者・本文・件数を表示し、ハッシュタグは検索へのリンクになる', () => {
    const wrapper = mountWithApp(PostCard, { post: makePost({ likeCount: 3 }) })

    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('@bob')
    expect(wrapper.find('a[href="/search?q=%23vue"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="いいね"]').text()).toContain('3')
  })

  it('リポストとして出ているときは「○○さんがリポストしました」を出す', () => {
    const wrapper = mountWithApp(PostCard, { post: makePost({ repostedBy: ALICE }) })
    expect(wrapper.text()).toContain('Aliceさんがリポストしました')
  })

  it('削除済み・非表示の投稿は、中身を出さずに「削除されました」とだけ出す', () => {
    const wrapper = mountWithApp(PostCard, { post: makePost({ status: 'deleted', content: '' }) })
    expect(wrapper.find('[data-testid="post-unavailable"]').text()).toBe('この投稿は削除されました')
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('いいねを押すと、すぐに change で「いいね済み」の投稿を伝える（楽観的更新）', async () => {
    const post = makePost()
    fetchMock.mockResolvedValue(jsonResponse({ ...post, liked: true, likeCount: 1 }))
    const wrapper = mountWithApp(PostCard, { post })

    await wrapper.find('button[aria-label="いいね"]').trigger('click')

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({ liked: true, likeCount: 1 })
  })

  it('自分の投稿のメニューには「削除」、他人の投稿には「通報」が出る', async () => {
    const auth = useAuthStore()
    auth.user = { ...BOB, email: 'bob@example.com', role: 'user' }
    const own = mountWithApp(PostCard, { post: makePost() })
    await own.find('button[aria-label="その他の操作"]').trigger('click')
    expect(own.text()).toContain('削除')

    auth.user = { ...ALICE, email: 'alice@example.com', role: 'user' }
    const others = mountWithApp(PostCard, { post: makePost() })
    await others.find('button[aria-label="その他の操作"]').trigger('click')
    expect(others.text()).toContain('ポストを通報')
  })

  it('「通報」を押すと、通報ダイアログをこの投稿で開く', async () => {
    const wrapper = mountWithApp(PostCard, { post: makePost() })
    await wrapper.find('button[aria-label="その他の操作"]').trigger('click')

    await wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text().includes('通報'))
      ?.trigger('click')

    expect(useUiStore().reportTarget).toMatchObject({ type: 'post', id: makePost().id })
  })
})

describe('postComposer', () => {
  beforeEach(() => {
    useAuthStore().user = makeAuthResponse().user
  })

  it('空のときは投稿ボタンを押せない', () => {
    const wrapper = mountWithApp(PostComposer)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('280 文字を超えたら投稿ボタンを押せない', async () => {
    const wrapper = mountWithApp(PostComposer)
    await wrapper.find('textarea').setValue('あ'.repeat(MAX_POST_LENGTH + 1))
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('投稿すると API を呼び、posted で作成された投稿を伝えて、入力を空にする', async () => {
    const created = makePost({ author: ALICE, content: 'はじめての投稿' })
    fetchMock.mockResolvedValue(jsonResponse(created, 201))
    const wrapper = mountWithApp(PostComposer)

    await wrapper.find('textarea').setValue('はじめての投稿')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      content: 'はじめての投稿',
      mediaUrls: [],
    })
    expect(wrapper.emitted('posted')?.[0]?.[0]).toEqual(created)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('返信のときは replyToId を付けて送り、「返信先: @handle」を出す', async () => {
    const parent = makePost()
    fetchMock.mockResolvedValue(
      jsonResponse(
        makePost({ id: '44444444-4444-4444-8444-444444444444', replyToId: parent.id }),
        201,
      ),
    )
    const wrapper = mountWithApp(PostComposer, { replyTo: parent })

    expect(wrapper.text()).toContain('返信先: @bob')
    await wrapper.find('textarea').setValue('返信です')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      replyToId: parent.id,
    })
  })
})
