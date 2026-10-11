// 通報の受付。受け付けた通報は「未対応」で保存され、管理者アプリ（admin）で処理される。

import type { Database } from '@xclone/db'
import type { CreateReportInput, ReportCreatedDto } from '@xclone/shared'
import { ERROR_CODES } from '@xclone/shared'
import { badRequest, conflict, isUniqueViolation, notFound } from '../errors'

export async function createReport(
  db: Database,
  reporterId: string,
  input: CreateReportInput,
): Promise<ReportCreatedDto> {
  await assertReportable(db, reporterId, input)

  try {
    const report = await db
      .insertInto('reports')
      .values({
        reporter_id: reporterId,
        target_type: input.targetType,
        target_post_id: input.targetType === 'post' ? input.targetId : null,
        target_user_id: input.targetType === 'user' ? input.targetId : null,
        reason: input.reason,
        detail: input.detail,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    return { id: report.id }
  } catch (error) {
    // 同じ人が同じ対象を 2 回通報したら、DB の一意制約で検出する
    if (isUniqueViolation(error)) throw conflict('すでに通報済みです', ERROR_CODES.ALREADY_REPORTED)
    throw error
  }
}

/** 通報できる対象か（存在する・自分自身や自分の投稿ではない） */
async function assertReportable(
  db: Database,
  reporterId: string,
  input: CreateReportInput,
): Promise<void> {
  if (input.targetType === 'post') {
    const post = await db
      .selectFrom('posts')
      .select(['author_id', 'status'])
      .where('id', '=', input.targetId)
      .executeTakeFirst()
    if (!post || post.status === 'deleted')
      throw notFound('この投稿は存在しません', ERROR_CODES.POST_NOT_FOUND)
    if (post.author_id === reporterId) throw badRequest('自分の投稿は通報できません')
    return
  }

  const user = await db
    .selectFrom('users')
    .select('id')
    .where('id', '=', input.targetId)
    .executeTakeFirst()
  if (!user) throw notFound('このアカウントは存在しません', ERROR_CODES.USER_NOT_FOUND)
  if (user.id === reporterId) throw badRequest('自分自身は通報できません')
}
