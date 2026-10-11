// 画像のアップロード（POST /media、multipart/form-data の file）。保存した画像の URL を返す。
//
// 安全のため 2 段階で確認する:
//   1. 申告された種類（Content-Type）と大きさ（multer の設定）
//   2. ファイルの中身の先頭（マジックナンバー）。拡張子や Content-Type は偽装できるため、本当に画像かを確かめる
// 保存先はローカルの uploads/（開発用）。本番ではオブジェクトストレージへ置き換える（docs/roadmap.md のバックログ）。

import type { MediaUploadDto } from '@xclone/shared'
import type { Request, Response } from 'express'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { ALLOWED_IMAGE_TYPES, POST_IMAGE_MAX_BYTES } from '@xclone/shared'
import multer from 'multer'
import { config } from '../config'
import { badRequest } from '../errors'

type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

const EXTENSIONS: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const INVALID_IMAGE_MESSAGE = '画像は jpeg・png・webp の5MB以下にしてください'

function isAllowedType(mimetype: string): mimetype is ImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimetype)
}

/** ファイルの先頭のバイト列から、本当にその種類の画像かを判定する */
function matchesSignature(type: ImageType, head: Buffer): boolean {
  if (type === 'image/png') return head.subarray(0, 8).equals(PNG_SIGNATURE)
  if (type === 'image/jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  // WebP: "RIFF" + 4 バイト（サイズ）+ "WEBP"
  return (
    head.subarray(0, 4).toString('ascii') === 'RIFF' &&
    head.subarray(8, 12).toString('ascii') === 'WEBP'
  )
}

/** ファイルの先頭 12 バイトを読む */
async function readHead(path: string): Promise<Buffer> {
  const file = await open(path, 'r')
  try {
    const head = Buffer.alloc(12)
    await file.read(head, 0, 12, 0)
    return head
  } finally {
    await file.close()
  }
}

mkdirSync(config.uploadDir, { recursive: true })

/** multer の設定: 1 回 1 枚、5MB まで、jpeg / png / webp だけ。ファイル名はランダムにする（推測・上書きを防ぐ） */
export const uploadImage = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, callback) => {
      const extension = isAllowedType(file.mimetype) ? EXTENSIONS[file.mimetype] : 'bin'
      callback(null, `${randomUUID()}.${extension}`)
    },
  }),
  limits: { fileSize: POST_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (isAllowedType(file.mimetype)) callback(null, true)
    else callback(badRequest(INVALID_IMAGE_MESSAGE))
  },
}).single('file')

/** POST /media — アップロードされた画像を確認し、URL を返す */
export async function uploadMedia(req: Request, res: Response) {
  const file = req.file
  if (!file) throw badRequest('画像ファイル（file）を送ってください')

  const type = file.mimetype
  if (!isAllowedType(type) || !matchesSignature(type, await readHead(file.path))) {
    await unlink(file.path) // 偽装されたファイルは保存しない
    throw badRequest(INVALID_IMAGE_MESSAGE)
  }

  const body: MediaUploadDto = { url: `${config.publicBaseUrl}/uploads/${file.filename}` }
  res.status(201).json(body)
}
