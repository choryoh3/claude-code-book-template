// 画像の URL が「このサーバーにアップロードされた画像」かを確かめる。
// shared の uploadedImageUrlSchema は形（http(s)・/uploads/<uuid>.<拡張子>）までしか見られないので、
// ここで「このサーバーの URL（PUBLIC_BASE_URL）から始まるか」を確かめる。外部の URL を保存させないため。

import { messages } from '@xclone/shared'
import { config } from '../config'
import { badRequest } from '../errors'

const OWN_UPLOAD_PREFIX = `${config.publicBaseUrl}/uploads/`

/** 1 つでも外部の URL が混ざっていたら 400（null / undefined は「指定なし・削除」なので対象外） */
export function assertOwnMediaUrls(urls: readonly (string | null | undefined)[]): void {
  for (const url of urls) {
    if (url && !url.startsWith(OWN_UPLOAD_PREFIX)) throw badRequest(messages.invalidMediaUrl)
  }
}
