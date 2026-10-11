// 画像のアップロードに関する契約。`POST /media`（multipart/form-data の file）で送ると、URL が返る。
// 返ってきた URL を、投稿の mediaUrls やプロフィールの avatarUrl / headerUrl に入れて使う。

import { z } from 'zod'
import { messages } from '../messages'

export const mediaUploadDtoSchema = z.object({ url: z.url() })
export type MediaUploadDto = z.infer<typeof mediaUploadDtoSchema>

/** アップロードした画像のパス: /uploads/<UUID>.<jpg|png|webp> */
const UPLOADED_IMAGE_PATH = /\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/

/**
 * 投稿の画像・アイコン・ヘッダーに指定できる URL（= `POST /media` でアップロードした画像だけ）。
 *
 * なぜ制限するか（セキュリティ）:
 * - 外部の URL を許すと、画像を見た人全員の IP アドレスなどが第三者に送られてしまう（トラッキング）
 * - `javascript:` の URL を許すと、画面がリンクとして表示したときにスクリプトが動いてしまう（XSS）
 * - 「中身を確認した画像」だけを使わせるため（`POST /media` は中身が本当に画像かを確かめている）
 *
 * ここでは「http(s) で、アップロードの形のパス」までを確かめる。どのサーバーの URL か（ホスト名）は、
 * 設定を知っている各サーバーが確かめる（user/server の lib/media-url.ts）。
 */
export const uploadedImageUrlSchema = z
  .url({ protocol: /^https?$/, error: messages.invalidMediaUrl })
  .regex(UPLOADED_IMAGE_PATH, messages.invalidMediaUrl)
