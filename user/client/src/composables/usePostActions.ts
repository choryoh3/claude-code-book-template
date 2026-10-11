// 投稿への反応（いいね・リポスト・ブックマーク）を「楽観的更新」で行う composable。
//
// 楽観的更新: サーバーの返事を待たずに、まず画面を変える（押した瞬間に色と数が変わる）。
// 成功したらサーバーの値で上書きし、失敗したら元に戻してトーストで知らせる（画面仕様書の共通仕様）。

import type { PostDto } from '@xclone/shared'
import type { ReactionKind } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { postApi } from '@/api/endpoints'
import { useToastStore } from '@/stores/toast'

/** 反応の種類ごとの「状態の項目」と「件数の項目」 */
const FIELDS = {
  like: { flag: 'liked', count: 'likeCount' },
  repost: { flag: 'reposted', count: 'repostCount' },
  bookmark: { flag: 'bookmarked', count: null },
} as const

/** 反応を切り替えた後の投稿（画面に先に見せる値）を作る */
export function toggledPost(post: PostDto, kind: ReactionKind): PostDto {
  const { flag, count } = FIELDS[kind]
  const next = !post[flag]
  const updated: PostDto = { ...post, [flag]: next }
  if (count) updated[count] = Math.max(0, post[count] + (next ? 1 : -1))
  return updated
}

/**
 * @param onChange 投稿が変わったときに呼ばれる（一覧の該当する 1 件を置き換える）
 */
export function usePostActions(onChange: (post: PostDto) => void) {
  const toast = useToastStore()
  /** 同じ投稿・同じ種類の連打で、通信が重ならないようにする */
  const pending = new Set<string>()

  async function toggle(post: PostDto, kind: ReactionKind) {
    const key = `${post.id}:${kind}`
    if (pending.has(key)) return
    pending.add(key)

    const optimistic = toggledPost(post, kind)
    onChange(optimistic) // 1. 先に画面を変える
    try {
      const saved = await postApi.react(post.id, kind, optimistic[FIELDS[kind].flag])
      // 2. サーバーの値で上書き（「リポストしました」の表示は一覧での見え方なので保つ）
      onChange({ ...saved, repostedBy: post.repostedBy })
    } catch (error) {
      onChange(post) // 3. 失敗したら元に戻す
      toast.error(errorMessage(error))
    } finally {
      pending.delete(key)
    }
  }

  return {
    toggleLike: (post: PostDto) => toggle(post, 'like'),
    toggleRepost: (post: PostDto) => toggle(post, 'repost'),
    toggleBookmark: (post: PostDto) => toggle(post, 'bookmark'),
  }
}
