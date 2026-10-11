// 投稿本文を「ふつうの文字・ハッシュタグ・メンション・URL」の部品に分ける。
// 画面はこの部品ごとにリンクを作る。v-html は使わない（本文に HTML が含まれていても、ただの文字として表示する = XSS 対策）。
//
// ハッシュタグ・メンションの規則は packages/shared の extractHashtags / extractMentions と同じにしている。
// （shared に「本文を部品に分ける関数」が入ったら、そちらに置き換える）

import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from '@xclone/shared'

export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string; tag: string }
  | { type: 'mention'; value: string; handle: string }
  | { type: 'url'; value: string }

/**
 * URL・ハッシュタグ・メンションのどれかに一致する部分を、1 つの正規表現でまとめて探す。
 * 名前付きグループで、どれに一致したかを見分ける。
 */
const TOKEN_PATTERN = new RegExp(
  [
    String.raw`(?<url>https?:\/\/[^\s<>"]+)`,
    String.raw`(?<hashtag>#(?<tag>[\p{L}\p{N}_]+))`,
    `(?<mention>@(?<handle>[A-Za-z0-9_]{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}))`,
  ].join('|'),
  'gu',
)

export function splitContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  let cursor = 0

  for (const match of content.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0
    if (start > cursor) segments.push({ type: 'text', value: content.slice(cursor, start) })

    const groups = match.groups ?? {}
    if (groups.url) segments.push({ type: 'url', value: groups.url })
    else if (groups.hashtag)
      segments.push({
        type: 'hashtag',
        value: groups.hashtag,
        tag: (groups.tag ?? '').toLowerCase(),
      })
    else if (groups.mention)
      segments.push({ type: 'mention', value: groups.mention, handle: groups.handle ?? '' })

    cursor = start + match[0].length
  }

  if (cursor < content.length) segments.push({ type: 'text', value: content.slice(cursor) })
  return segments
}
