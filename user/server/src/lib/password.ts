// パスワードのハッシュ化と照合（bcrypt）。

import bcrypt from 'bcrypt'

/** ハッシュ化の強度。seed（packages/db/seed.ts）と同じ値にしている */
const BCRYPT_COST = 10

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

let dummyHash: Promise<string> | undefined

/**
 * 存在しないメールアドレスでも、照合と同じくらいの時間をかけるためのダミー照合。
 * 「すぐ返ってきた = そのメールは登録されていない」と、応答時間からアカウントの有無を推測されるのを防ぐ。
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing')
  await bcrypt.compare(password, await dummyHash)
  return false
}
