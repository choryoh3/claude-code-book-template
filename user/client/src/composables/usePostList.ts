// 投稿の一覧用の useCursorList。行の「目印（キー）」を「投稿 ID + リポストした人」にする
// （同じ投稿が、本人の投稿とリポストで 2 回並んでも、別の行として扱えるように）。

import type { PostDto } from '@xclone/shared'
import type { CursorPage } from './useCursorList'
import { useCursorList } from './useCursorList'

/** 一覧の 1 行の目印 */
export function postKey(post: PostDto): string {
  return `${post.id}:${post.repostedBy?.id ?? ''}`
}

export function usePostList(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<PostDto>>,
) {
  return useCursorList(fetchPage, postKey)
}
