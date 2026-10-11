// 投稿本文の解析（ハッシュタグ・メンションの取り出し）。
// 投稿の保存時（server）と、本文のリンク表示（client）の両方が同じ規則を使えるよう、ここに 1 つだけ置く。

import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from './constants'

/** 「#タグ」: 英数字・アンダースコア・日本語などの文字（Unicode の文字と数字）が続く部分 */
const HASHTAG_PATTERN = /#([\p{L}\p{N}_]+)/gu
/** 「@ハンドル」: 半角英数字と _ の 3〜15 文字 */
const MENTION_PATTERN = new RegExp(
  `@([A-Za-z0-9_]{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}})`,
  'g',
)

/**
 * 本文からハッシュタグを取り出す。
 * - `#` は除き、小文字にそろえる（#Vue と #vue を同じタグとして扱う）
 * - 同じタグが複数あっても 1 つだけ返す（出現順）
 *
 * @example extractHashtags('今日は #Vue と #vue と #開発日記') // → ['vue', '開発日記']
 */
export function extractHashtags(content: string): string[] {
  const tags = Array.from(content.matchAll(HASHTAG_PATTERN), (match) =>
    (match[1] ?? '').toLowerCase(),
  )
  return [...new Set(tags)]
}

/**
 * 本文からメンション（@ハンドル）を取り出す。`@` は除き、小文字にそろえる。重複は 1 つにする。
 *
 * @example extractMentions('@Alice さん、@bob も見て') // → ['alice', 'bob']
 */
export function extractMentions(content: string): string[] {
  const handles = Array.from(content.matchAll(MENTION_PATTERN), (match) =>
    (match[1] ?? '').toLowerCase(),
  )
  return [...new Set(handles)]
}

/**
 * 文字列を UTF-8 にしたときのバイト数（英数字は 1、ひらがな・漢字は 3、絵文字は 4 バイト）。
 * bcrypt が「72 バイト」までしか扱えないため、パスワードの長さの確認に使う。
 * TextEncoder を使わないのは、shared を実行環境（ブラウザ / Node）に依存させないため。
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0
    if (codePoint <= 0x7f) bytes += 1
    else if (codePoint <= 0x7ff) bytes += 2
    else if (codePoint <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}
