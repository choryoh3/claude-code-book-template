// seed のソーシャルな関係: フォロー、いいね、リポスト、ブックマーク。
// 同時に「誰が何をしたか」の出来事（SeedEvent）も返す。通知（notifications.ts）の元になる。
import type { Insertable } from 'kysely'
import type { Bookmarks, Follows, Likes, Reposts } from '../src/generated/db'
import type { Random } from './random'
import type { SeedEvent, SeedPost, SeedUser } from './types'
import { addMinutes, daysBefore, earlier } from './clock'

/** 投稿のいいね数の目安（投稿者ごと）。alice の投稿に反応が集まるようにする */
const LIKES_RANGE: Record<string, [min: number, max: number]> = {
  alice: [1, 5],
  bob: [0, 3],
  carol: [0, 3],
}
const LIKES_RANGE_DEFAULT: [number, number] = [0, 1]
/** ボリューム用ユーザー（user06〜user30）のハンドル */
const VOLUME_HANDLE_PATTERN = /^user\d+$/
/** 投稿がリポスト・ブックマークされる確率 */
const REPOST_CHANCE = 0.12
const BOOKMARK_CHANCE = 0.12

export interface BuiltSocial {
  follows: Insertable<Follows>[]
  likes: Insertable<Likes>[]
  reposts: Insertable<Reposts>[]
  bookmarks: Insertable<Bookmarks>[]
  events: SeedEvent[]
}

export function buildSocial(
  base: Date,
  random: Random,
  users: SeedUser[],
  posts: SeedPost[],
): BuiltSocial {
  const byHandle = new Map(users.map((user) => [user.handle, user]))
  const must = (handle: string): SeedUser => {
    const user = byHandle.get(handle)
    if (!user) throw new Error(`ユーザーが見つかりません: ${handle}`)
    return user
  }
  /** 反応する側になれるユーザー（管理者・凍結中・eve（活動なしの確認用）は除く） */
  const actors = users.filter(
    (user) => user.role === 'user' && !user.isSuspended && user.handle !== 'eve',
  )
  const volumeUsers = actors.filter((user) => VOLUME_HANDLE_PATTERN.test(user.handle))
  const visiblePosts = posts.filter((post) => post.status === 'visible')

  const events: SeedEvent[] = []

  /** 出来事が起きた時刻: 元の時刻より後で、基準日より未来にならない */
  const timeAfter = (from: Date, maxMinutes: number) =>
    earlier(addMinutes(from, random.int(1, maxMinutes)), addMinutes(base, -1))

  // ---------------------------------------------------------------- フォロー
  const followKeys = new Set<string>()
  const follows: Insertable<Follows>[] = []

  const follow = (follower: SeedUser, followee: SeedUser) => {
    const key = `${follower.id}>${followee.id}`
    if (follower.id === followee.id || followKeys.has(key)) return
    followKeys.add(key)
    const startedAt =
      follower.createdAt > followee.createdAt ? follower.createdAt : followee.createdAt
    const at = timeAfter(startedAt, 20 * 24 * 60)
    follows.push({ follower_id: follower.id, followee_id: followee.id, created_at: at })
    events.push({
      type: 'follow',
      actorId: follower.id,
      postId: null,
      recipientId: followee.id,
      at,
    })
  }

  const followList: Record<string, string[]> = {
    alice: ['bob', 'carol', 'user06', 'user07', 'user08', 'user09', 'user10'],
    bob: ['alice', 'carol', 'user06', 'user07', 'user11', 'user12'],
    carol: ['alice', 'bob', 'user13', 'user14'],
    dave: ['alice', 'bob'],
    // eve は誰もフォローしない（空状態の確認用）
  }
  for (const [follower, followees] of Object.entries(followList)) {
    for (const followee of followees) follow(must(follower), must(followee))
  }
  for (const user of volumeUsers) {
    if (random.chance(0.7)) follow(user, must('alice'))
    if (random.chance(0.5)) follow(user, must('bob'))
    if (random.chance(0.5)) follow(user, must('carol'))
    for (let i = 0; i < random.int(1, 3); i++) follow(user, random.pick(volumeUsers))
  }

  // ---------------------------------------------------------------- いいね・リポスト・ブックマーク
  const likeKeys = new Set<string>()
  const repostKeys = new Set<string>()
  const bookmarkKeys = new Set<string>()
  const likes: Insertable<Likes>[] = []
  const reposts: Insertable<Reposts>[] = []
  const bookmarks: Insertable<Bookmarks>[] = []

  const react = (kind: 'like' | 'repost' | 'bookmark', actor: SeedUser, post: SeedPost) => {
    if (actor.id === post.authorId || actor.createdAt > post.createdAt) return
    const keys = { like: likeKeys, repost: repostKeys, bookmark: bookmarkKeys }[kind]
    const key = `${actor.id}>${post.id}`
    if (keys.has(key)) return
    keys.add(key)

    const at = timeAfter(post.createdAt, 3 * 24 * 60)
    const row = { user_id: actor.id, post_id: post.id, created_at: at }
    if (kind === 'like') likes.push(row)
    if (kind === 'repost') reposts.push(row)
    if (kind === 'bookmark') bookmarks.push(row)
    // ブックマークは本人しか知らないので通知の元にはしない
    if (kind !== 'bookmark')
      events.push({
        type: kind,
        actorId: actor.id,
        postId: post.id,
        recipientId: post.authorId,
        at,
      })
  }

  for (const post of visiblePosts) {
    const [min, max] = LIKES_RANGE[post.authorHandle] ?? LIKES_RANGE_DEFAULT
    for (const actor of random.shuffle(actors).slice(0, random.int(min, max)))
      react('like', actor, post)

    const repostChance = ['alice', 'bob', 'carol'].includes(post.authorHandle)
      ? REPOST_CHANCE * 2
      : REPOST_CHANCE
    if (random.chance(repostChance)) react('repost', random.pick(actors), post)
    if (random.chance(BOOKMARK_CHANCE)) react('bookmark', random.pick(actors), post)
  }

  // alice 自身の活動（「いいね」タブ・ブックマーク画面・リポストの確認用）。alice 以外の投稿に対して行う
  const alice = must('alice')
  const othersPosts = visiblePosts.filter((post) => post.authorId !== alice.id)
  random
    .shuffle(othersPosts)
    .slice(0, 15)
    .forEach((post) => react('like', alice, post))
  random
    .shuffle(othersPosts)
    .slice(0, 6)
    .forEach((post) => react('bookmark', alice, post))
  random
    .shuffle(othersPosts)
    .slice(0, 3)
    .forEach((post) => react('repost', alice, post))

  // dave は凍結前に少しだけ活動していた
  const daveEnd = daysBefore(base, 3)
  for (const post of othersPosts.filter((candidate) => candidate.createdAt < daveEnd).slice(0, 4)) {
    react('like', must('dave'), post)
  }

  return { follows, likes, reposts, bookmarks, events }
}
