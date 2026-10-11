// seed の投稿: 通常の投稿・リプライ・引用・画像つき・特殊な状態（削除済み・非表示）を作る。
// 作る内容と件数は docs/test-data.md に書いてある。変えたら両方を更新すること。

import type { Insertable } from 'kysely'
import type { Hashtags, PostHashtags, Posts } from '../src/generated/db'
import type { Random } from './random'
import type { SeedPost, SeedUser } from './types'
// 文字数の上限とハッシュタグの取り出し方は、アプリ本体と同じもの（packages/shared）を使う
import { extractHashtags, MAX_POST_LENGTH } from '@xclone/shared'
import { addHours, addMinutes, daysBefore, earlier } from './clock'
import { stableUuid } from './random'

// ---------------------------------------------------------------- 投稿の材料（文章の部品）
const TOPICS = [
  { name: 'Vue 3', tag: 'vue' },
  { name: 'Pinia', tag: 'pinia' },
  { name: 'TypeScript', tag: 'typescript' },
  { name: 'PostgreSQL', tag: 'postgres' },
  { name: 'Express 5', tag: 'express' },
  { name: 'Tailwind CSS v4', tag: 'tailwind' },
  { name: 'Vite', tag: 'vite' },
  { name: 'Kysely', tag: 'kysely' },
  { name: 'Playwright', tag: 'playwright' },
  { name: 'Claude Code', tag: 'claude' },
  { name: 'Socket.IO', tag: 'socketio' },
  { name: 'Zod', tag: 'zod' },
]
/** トレンドに偏りが出るよう、よく使われるタグを多めに混ぜる */
const GENERAL_TAGS = ['xclone', 'xclone', '開発日記', '開発日記', '勉強中', 'テスト']
const OPENINGS = ['今日は', '昨日は', 'さっき', '最近', '週末に', '朝から']
const ACTIONS = [
  'を触ってみた',
  'の公式ドキュメントを読んだ',
  'で小さなアプリを作った',
  'について調べた',
  'を使って機能を実装した',
]
const IMPRESSIONS = [
  '思ったより簡単だった！',
  'まだ分からないことだらけ…',
  '型が付くと安心感がある。',
  '書き味がとても良い。',
  '明日ももう少し試してみる。',
  'ハマったけど、原因が分かってスッキリ。',
]
const REPLY_TEXTS = [
  'なるほど、参考になります！',
  '私も同じことで悩んでいました。',
  'ありがとうございます、試してみます。',
  'それは面白いですね。',
  '詳しく聞きたいです！',
]
const QUOTE_TEXTS = [
  'これ、すごく分かる。',
  'みんな読んでほしい投稿。',
  '自分も試した結果を書きます。',
  'ここがポイントだと思う。',
]

/** 1 人あたりに作る通常投稿の数（名前付きユーザー）。それ以外のユーザーは OTHER_POSTS_PER_USER 件 */
const POSTS_PER_NAMED_USER: Record<string, number> = { alice: 28, bob: 22, carol: 22, dave: 8 }
const OTHER_POSTS_PER_USER = 3
const REPLY_COUNT = 30
const REPLY_TO_REPLY_COUNT = 3
const QUOTE_COUNT = 12
/** carol の画像つき投稿の画像枚数（1〜4 枚をすべて含む） */
const CAROL_MEDIA_COUNTS = [1, 2, 3, 4, 1, 2, 1, 3, 4, 2]

// ---------------------------------------------------------------- 文章を作る関数
/** 280 文字ちょうどの投稿。「上限ぴったりが保存・表示できるか」の確認用 */
function composeExactly280(): string {
  const intro =
    'これは文字数ちょうど 280 文字の投稿です。上限ぴったりの文章が正しく保存・表示されることを確認するためのテストデータです。 #xclone #テスト\n'
  const filler = '文字数の上限を確認するために、同じ文を繰り返してかさ増ししています。'
  let text = intro
  while (text.length < MAX_POST_LENGTH) text += filler
  const result = text.slice(0, MAX_POST_LENGTH)
  if (Array.from(result).length !== MAX_POST_LENGTH)
    throw new Error('280 文字の投稿の作成に失敗しました')
  return result
}

/** 改行・箇条書き・URL を含む投稿（本文のリンク化や改行の表示の確認用） */
const MULTILINE_POST =
  '本日のメモ\n・Pinia の store は setup 形式で書く\n・詳細は https://pinia.vuejs.org/ を参照 #pinia #vue'

/** ふつうの投稿の本文（話題 + 感想 + ハッシュタグ。ときどきメンションを付ける） */
function composeContent(random: Random, mentionHandle?: string): string {
  const topic = random.pick(TOPICS)
  const sentence = `${random.pick(OPENINGS)}${topic.name}${random.pick(ACTIONS)}。${random.pick(IMPRESSIONS)}`
  const tags: string[] = []
  if (random.chance(0.5)) tags.push(`#${topic.tag}`)
  if (random.chance(0.3)) tags.push(`#${random.pick(GENERAL_TAGS)}`)
  const mention = mentionHandle ? `@${mentionHandle} ` : ''
  return [mention + sentence, ...tags].join(' ').trim()
}

// ---------------------------------------------------------------- 投稿を組み立てる
export interface BuiltPosts {
  rows: Insertable<Posts>[]
  posts: SeedPost[]
  hashtagRows: Insertable<Hashtags>[]
  postHashtagRows: Insertable<PostHashtags>[]
}

/** 作る途中の投稿に、関連づけに必要な情報（作成順の番号）を持たせたもの */
interface DraftPost extends SeedPost {
  seq: number
}

export function buildPosts(base: Date, random: Random, users: SeedUser[]): BuiltPosts {
  const regularUsers = users.filter((user) => user.role === 'user')
  const byHandle = new Map(users.map((user) => [user.handle, user]))
  const drafts: DraftPost[] = []
  let seq = 0

  /** 投稿を 1 件作って drafts に追加する */
  const create = (
    author: SeedUser,
    fields: Pick<SeedPost, 'content' | 'createdAt'> & Partial<SeedPost>,
  ): DraftPost => {
    seq += 1
    // 登録日より前の投稿にならないようにする（登録の 1 時間後以降）
    const notBefore = addHours(author.createdAt, 1)
    const createdAt = fields.createdAt < notBefore ? notBefore : fields.createdAt
    const draft: DraftPost = {
      id: stableUuid(`post:${seq}`),
      seq,
      authorId: author.id,
      authorHandle: author.handle,
      content: fields.content,
      mediaUrls: fields.mediaUrls ?? [],
      replyToId: fields.replyToId ?? null,
      quoteOfId: fields.quoteOfId ?? null,
      status: fields.status ?? 'visible',
      statusChangedAt: fields.statusChangedAt ?? null,
      createdAt: earlier(createdAt, addMinutes(base, -1)),
    }
    drafts.push(draft)
    return draft
  }

  const imageUrls = (postSeq: number, count: number) =>
    Array.from(
      { length: count },
      (_, i) => `https://picsum.photos/seed/xclone-${postSeq}-${i + 1}/800/600`,
    )

  /** 新しい投稿ほど多くなるように、基準日から数えた「何日前か」を選ぶ */
  const randomPastTime = (minDaysAgo = 0, maxDaysAgo = 29) => {
    const skewed = Math.floor(random.next() ** 1.6 * (maxDaysAgo - minDaysAgo + 1)) + minDaysAgo
    return addMinutes(daysBefore(base, skewed), -random.int(1, 1300))
  }

  // ---- 1) 通常の投稿（人ごとに決めた件数）
  for (const user of regularUsers) {
    if (user.handle === 'eve') continue // eve は「投稿 0 件」の確認用なので何も投稿しない
    const count = POSTS_PER_NAMED_USER[user.handle] ?? OTHER_POSTS_PER_USER
    const isDave = user.handle === 'dave'

    for (let i = 0; i < count; i++) {
      // dave は凍結された 2 日前より前にだけ投稿している
      const createdAt = isDave ? randomPastTime(3, 19) : randomPastTime()
      // 7 件に 1 件はメンション付き（alice 宛が多い。alice 本人の投稿は bob 宛）。メンション通知の確認用
      const mentionHandle = i % 7 === 3 ? (user.handle === 'alice' ? 'bob' : 'alice') : undefined
      let content = composeContent(random, mentionHandle)
      let mediaUrls: string[] = []

      if (user.handle === 'alice' && i === 0) content = composeExactly280()
      if (user.handle === 'alice' && i === 1) content = MULTILINE_POST
      if (user.handle === 'carol' && i < CAROL_MEDIA_COUNTS.length) {
        mediaUrls = imageUrls(seq + 1, CAROL_MEDIA_COUNTS[i] ?? 1)
        if (i === 4) content = '' // 本文なし・画像だけの投稿
      } else if (random.chance(0.05)) {
        mediaUrls = imageUrls(seq + 1, 1)
      }
      create(user, { content, createdAt, mediaUrls })
    }
  }

  // ---- 2) 特殊な状態の投稿（削除済み・管理者が非表示・非表示を解除）
  const firstPostOf = (handle: string) => drafts.find((post) => post.authorHandle === handle)
  const changeStatus = (
    post: DraftPost | undefined,
    status: DraftPost['status'],
    afterHours: number,
  ) => {
    if (!post) throw new Error('状態を変える投稿が見つかりません')
    post.status = status
    post.statusChangedAt = earlier(addHours(post.createdAt, afterHours), addMinutes(base, -1))
  }
  changeStatus(firstPostOf('dave'), 'hidden', 30) // 管理者が非表示（スパム）
  changeStatus(firstPostOf('user12'), 'hidden', 40) // 管理者が非表示（不適切）
  changeStatus(firstPostOf('user22'), 'deleted', 20) // 管理者が削除
  changeStatus(firstPostOf('bob'), 'deleted', 3) // 本人が削除
  changeStatus(firstPostOf('user08'), 'deleted', 5) // 本人が削除
  changeStatus(firstPostOf('user14'), 'visible', 50) // 非表示にしたあと解除（監査ログ用）

  // ---- 3) リプライ・引用は「表示中の投稿」にだけ付ける
  const visibleParents = () => drafts.filter((post) => post.status === 'visible')
  const activeAuthors = regularUsers.filter((user) => !user.isSuspended && user.handle !== 'eve')

  /** parent に対するリプライを 1 件作る。作れなかった（適した投稿者がいない）ときは null */
  const createReply = (parent: DraftPost): DraftPost | null => {
    const candidates = activeAuthors.filter(
      (user) => user.id !== parent.authorId && user.createdAt < parent.createdAt,
    )
    if (candidates.length === 0) return null
    const author = random.pick(candidates)
    return create(author, {
      content: `@${parent.authorHandle} ${random.pick(REPLY_TEXTS)}`,
      createdAt: addMinutes(parent.createdAt, random.int(5, 36 * 60)),
      replyToId: parent.id,
    })
  }

  const replies: DraftPost[] = []
  while (replies.length < REPLY_COUNT) {
    // alice の投稿に返信が集まりやすいようにする（スレッド表示の確認用）
    const pool = random.chance(0.5)
      ? visibleParents().filter((post) => post.authorHandle === 'alice')
      : visibleParents()
    const reply = createReply(random.pick(pool))
    if (reply) replies.push(reply)
  }
  for (let i = 0; i < REPLY_TO_REPLY_COUNT; i++) {
    const reply = createReply(random.pick(replies)) // リプライへのリプライ（会話の続き）
    if (reply) replies.push(reply)
  }

  for (let i = 0; i < QUOTE_COUNT; i++) {
    const quoted = random.pick(visibleParents().filter((post) => post.replyToId === null))
    const candidates = activeAuthors.filter(
      (user) => user.id !== quoted.authorId && user.createdAt < quoted.createdAt,
    )
    if (candidates.length === 0) continue
    create(random.pick(candidates), {
      content: random.pick(QUOTE_TEXTS),
      createdAt: addMinutes(quoted.createdAt, random.int(10, 48 * 60)),
      quoteOfId: quoted.id,
    })
  }

  // ---- 4) 仕上げ: 古い順に並べ、制約（文字数・画像枚数）を確認する
  drafts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.seq - b.seq)
  for (const post of drafts) {
    if (Array.from(post.content).length > MAX_POST_LENGTH)
      throw new Error(`投稿が 280 文字を超えています: ${post.id}`)
    if (post.mediaUrls.length > 4) throw new Error(`画像が 4 枚を超えています: ${post.id}`)
  }

  const posts: SeedPost[] = drafts.map(({ seq: _seq, ...post }) => post)
  const rows: Insertable<Posts>[] = posts.map((post) => ({
    id: post.id,
    author_id: post.authorId,
    content: post.content,
    media_urls: post.mediaUrls,
    reply_to_id: post.replyToId,
    quote_of_id: post.quoteOfId,
    status: post.status,
    status_changed_at: post.statusChangedAt,
    created_at: post.createdAt,
    // 更新日時は「最後に状態が変わった時刻」。指定しないと実行時刻（now()）になり、実行のたびに値が変わってしまう
    updated_at: post.statusChangedAt ?? post.createdAt,
  }))

  // 投稿者が実在することの確認（seed のバグを早く見つけるため）
  for (const post of posts) {
    if (!byHandle.has(post.authorHandle))
      throw new Error(`投稿者が見つかりません: ${post.authorHandle}`)
  }

  return { rows, posts, ...buildHashtags(posts) }
}

/** 投稿の本文から「#タグ」を取り出し、hashtags と post_hashtags の行を作る */
function buildHashtags(posts: SeedPost[]) {
  const firstUsedAt = new Map<string, Date>()
  const postHashtagRows: Insertable<PostHashtags>[] = []

  for (const post of posts) {
    for (const tag of extractHashtags(post.content)) {
      if (!firstUsedAt.has(tag)) firstUsedAt.set(tag, post.createdAt)
      postHashtagRows.push({
        post_id: post.id,
        hashtag_id: stableUuid(`hashtag:${tag}`),
        created_at: post.createdAt,
      })
    }
  }

  const hashtagRows: Insertable<Hashtags>[] = Array.from(firstUsedAt, ([tag, createdAt]) => ({
    id: stableUuid(`hashtag:${tag}`),
    tag,
    created_at: createdAt,
  }))
  return { hashtagRows, postHashtagRows }
}
