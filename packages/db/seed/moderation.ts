// seed の運営まわり: 通報、管理者操作の監査ログ、日次の利用者（DAU）。
// 通報 → 対応 → 監査ログ、の時刻の前後関係が矛盾しないように作る。

import type { Insertable } from 'kysely'
import type { AuditLogs, DailyActiveUsers, Json, Reports } from '../src/generated/db'
import type { Random } from './random'
import type { SeedPost, SeedUser } from './types'
import { addHours, addMinutes, daysBefore, earlier, toDateString } from './clock'
import { stableUuid } from './random'
import { DAVE_SUSPENDED_DAYS_AGO } from './users'

type ReportStatus = 'open' | 'in_progress' | 'resolved'
type AdminHandle = 'admin' | 'admin2'
type AuditRow = Insertable<AuditLogs>

/** 通報 1 件の定義。target は「投稿」か「ユーザー（ハンドル）」のどちらか */
interface ReportPlan {
  reporter: string
  target: { post: SeedPost } | { userHandle: string }
  reason: 'spam' | 'harassment' | 'inappropriate' | 'other'
  detail: string
  status: ReportStatus
  adminNote: string
  handledBy?: AdminHandle
}

/** 管理者の操作元 IP（ドキュメント用の予約アドレス。実在しない） */
const ADMIN_IP: Record<AdminHandle, string> = { admin: '192.0.2.10', admin2: '192.0.2.11' }
/** DAU を作る日数（ダッシュボードの 7 / 14 / 30 日の切り替えに対応） */
const DAU_DAYS = 30

export interface BuiltModeration {
  reports: Insertable<Reports>[]
  auditLogs: AuditRow[]
  dailyActiveUsers: Insertable<DailyActiveUsers>[]
}

export function buildModeration(
  base: Date,
  random: Random,
  users: SeedUser[],
  posts: SeedPost[],
): BuiltModeration {
  const userByHandle = new Map(users.map((user) => [user.handle, user]))
  const must = (handle: string): SeedUser => {
    const user = userByHandle.get(handle)
    if (!user) throw new Error(`ユーザーが見つかりません: ${handle}`)
    return user
  }
  const mustPost = (predicate: (post: SeedPost) => boolean, label: string): SeedPost => {
    const post = posts.find(predicate)
    if (!post) throw new Error(`投稿が見つかりません: ${label}`)
    return post
  }
  const lastMinute = addMinutes(base, -1)
  const auditLogs: AuditRow[] = []

  /** 監査ログを 1 件追加する */
  const audit = (
    admin: AdminHandle,
    action: AuditRow['action'],
    target: { type: 'user' | 'post' | 'report'; id: string },
    at: Date,
    detail: Json,
  ) => {
    auditLogs.push({
      id: stableUuid(`audit:${auditLogs.length + 1}`),
      admin_id: must(admin).id,
      action,
      target_type: target.type,
      target_id: target.id,
      detail,
      ip: ADMIN_IP[admin],
      created_at: earlier(at, lastMinute),
    })
  }

  // ---------------------------------------------------------------- 管理者の操作（投稿の状態変更・ユーザー凍結など）
  const daveHidden = mustPost(
    (p) => p.authorHandle === 'dave' && p.status === 'hidden',
    'dave の非表示',
  )
  const user12Hidden = mustPost(
    (p) => p.authorHandle === 'user12' && p.status === 'hidden',
    'user12 の非表示',
  )
  const user22Deleted = mustPost(
    (p) => p.authorHandle === 'user22' && p.status === 'deleted',
    'user22 の削除',
  )
  const user14Restored = mustPost(
    (p) => p.authorHandle === 'user14' && p.status === 'visible' && p.statusChangedAt !== null,
    'user14 の非表示解除',
  )
  const statusChangedAt = (post: SeedPost) => post.statusChangedAt ?? post.createdAt

  audit('admin', 'post_hide', { type: 'post', id: daveHidden.id }, statusChangedAt(daveHidden), {
    reason: 'スパム',
    previousStatus: 'visible',
  })
  audit(
    'admin2',
    'post_hide',
    { type: 'post', id: user12Hidden.id },
    statusChangedAt(user12Hidden),
    {
      reason: '不適切な内容',
      previousStatus: 'visible',
    },
  )
  audit(
    'admin2',
    'post_delete',
    { type: 'post', id: user22Deleted.id },
    statusChangedAt(user22Deleted),
    {
      reason: '規約違反（スパム）',
      previousStatus: 'visible',
    },
  )
  // user14 の投稿: いったん非表示にして、確認の結果、解除した
  audit(
    'admin',
    'post_hide',
    { type: 'post', id: user14Restored.id },
    addHours(user14Restored.createdAt, 30),
    {
      reason: '通報の確認のため一時的に非表示',
      previousStatus: 'visible',
    },
  )
  audit(
    'admin',
    'post_unhide',
    { type: 'post', id: user14Restored.id },
    statusChangedAt(user14Restored),
    {
      reason: '問題なしと判断',
      previousStatus: 'hidden',
    },
  )

  const dave = must('dave')
  const daveSuspendedAt = daysBefore(base, DAVE_SUSPENDED_DAYS_AGO)
  audit('admin', 'user_suspend', { type: 'user', id: dave.id }, daveSuspendedAt, {
    reason: '嫌がらせ投稿の繰り返し（通報 2 件）',
  })
  audit('admin', 'force_logout', { type: 'user', id: dave.id }, addMinutes(daveSuspendedAt, 5), {
    revokedTokens: 1,
  })

  // user19: 凍結 → 誤検知だったので解除（凍結中のユーザーが 1 人だけであることは保つ）
  const user19 = must('user19')
  const user19SuspendedAt = earlier(addHours(user19.createdAt, 72), daysBefore(base, 2))
  audit('admin', 'user_suspend', { type: 'user', id: user19.id }, user19SuspendedAt, {
    reason: '規約違反の疑い',
  })
  audit(
    'admin2',
    'user_unsuspend',
    { type: 'user', id: user19.id },
    addHours(user19SuspendedAt, 48),
    {
      reason: '誤検知のため',
    },
  )

  // admin2 は、はじめ一般ユーザーとして登録され、35 日前に管理者へ昇格した
  audit('admin', 'role_change', { type: 'user', id: must('admin2').id }, daysBefore(base, 35), {
    from: 'user',
    to: 'admin',
  })

  // ---------------------------------------------------------------- 通報
  const carolPost = mustPost(
    (p) => p.authorHandle === 'carol' && p.status === 'visible' && p.mediaUrls.length > 0,
    'carol の画像投稿',
  )
  const bobPost = mustPost((p) => p.authorHandle === 'bob' && p.status === 'visible', 'bob の投稿')
  const user18Post = mustPost(
    (p) => p.authorHandle === 'user18' && p.status === 'visible',
    'user18 の投稿',
  )
  const user25Post = mustPost(
    (p) => p.authorHandle === 'user25' && p.status === 'visible',
    'user25 の投稿',
  )

  const plans: ReportPlan[] = [
    // 完了（5 件）
    {
      reporter: 'alice',
      target: { post: daveHidden },
      reason: 'spam',
      detail: '同じ宣伝文が何度も投稿されています',
      status: 'resolved',
      adminNote: 'スパムと確認。投稿を非表示にしました。',
      handledBy: 'admin',
    },
    {
      reporter: 'bob',
      target: { post: daveHidden },
      reason: 'spam',
      detail: '',
      status: 'resolved',
      adminNote: '同一内容の通報。対応済み。',
      handledBy: 'admin',
    },
    {
      reporter: 'alice',
      target: { userHandle: 'dave' },
      reason: 'harassment',
      detail: '私や他のユーザーに執拗にリプライを送ってきます',
      status: 'resolved',
      adminNote: 'アカウントを凍結しました。',
      handledBy: 'admin2',
    },
    {
      reporter: 'carol',
      target: { post: user12Hidden },
      reason: 'inappropriate',
      detail: '',
      status: 'resolved',
      adminNote: '不適切な内容のため非表示にしました。',
      handledBy: 'admin',
    },
    {
      reporter: 'user07',
      target: { post: user22Deleted },
      reason: 'spam',
      detail: '外部サイトへの誘導です',
      status: 'resolved',
      adminNote: '規約違反のため削除しました。',
      handledBy: 'admin2',
    },
    // 対応中（3 件）
    {
      reporter: 'user07',
      target: { userHandle: 'user20' },
      reason: 'harassment',
      detail: 'しつこくメンションされます',
      status: 'in_progress',
      adminNote: '確認中。投稿履歴を調査しています。',
      handledBy: 'admin',
    },
    {
      reporter: 'user08',
      target: { post: bobPost },
      reason: 'spam',
      detail: '',
      status: 'in_progress',
      adminNote: '内容を確認中。',
      handledBy: 'admin2',
    },
    {
      reporter: 'user09',
      target: { post: user25Post },
      reason: 'inappropriate',
      detail: '',
      status: 'in_progress',
      adminNote: '他の通報と合わせて確認中。',
      handledBy: 'admin',
    },
    // 未対応（4 件）
    {
      reporter: 'bob',
      target: { post: carolPost },
      reason: 'other',
      detail: '画像の著作権が気になります',
      status: 'open',
      adminNote: '',
    },
    {
      reporter: 'user06',
      target: { post: carolPost },
      reason: 'other',
      detail: '',
      status: 'open',
      adminNote: '',
    },
    {
      reporter: 'user10',
      target: { post: user18Post },
      reason: 'spam',
      detail: '',
      status: 'open',
      adminNote: '',
    },
    {
      reporter: 'user11',
      target: { post: bobPost },
      reason: 'spam',
      detail: '宣伝のように見えます',
      status: 'open',
      adminNote: '',
    },
  ]

  const reports: Insertable<Reports>[] = plans.map((plan, index) => {
    const reporter = must(plan.reporter)
    const targetPost = 'post' in plan.target ? plan.target.post : undefined
    const targetUser = 'userHandle' in plan.target ? must(plan.target.userHandle) : undefined
    const targetCreatedAt = targetPost?.createdAt ?? targetUser?.createdAt ?? base

    // 通報した時刻: 対象が作られたあと、かつ通報者が登録したあと
    const afterTarget = addMinutes(targetCreatedAt, 20)
    const afterReporter = addHours(reporter.createdAt, 1)
    const createdAt = earlier(afterTarget > afterReporter ? afterTarget : afterReporter, lastMinute)

    // 対応した時刻: ユーザー凍結・投稿の状態変更と一致させる。無ければ通報の数時間後
    const actionAt =
      targetPost?.statusChangedAt ?? (targetUser?.isSuspended ? daveSuspendedAt : undefined)
    const fallback = addHours(createdAt, random.int(2, 30))
    const wanted = actionAt && actionAt > createdAt ? actionAt : fallback
    const handledAt = plan.status === 'open' ? null : earlier(wanted, lastMinute)
    const handledAtSafe = handledAt && handledAt < createdAt ? createdAt : handledAt

    const id = stableUuid(`report:${index + 1}`)
    const admin = plan.handledBy

    // 通報の処理は監査ログにも残す（未対応 → 対応中 → 完了）
    if (handledAtSafe && admin) {
      const midpoint = new Date(
        createdAt.getTime() + (handledAtSafe.getTime() - createdAt.getTime()) / 3,
      )
      const targetType = 'report' as const
      if (plan.status === 'resolved') {
        audit(admin, 'report_update', { type: targetType, id }, midpoint, {
          from: 'open',
          to: 'in_progress',
        })
        audit(admin, 'report_update', { type: targetType, id }, handledAtSafe, {
          from: 'in_progress',
          to: 'resolved',
          adminNote: plan.adminNote,
        })
      } else {
        audit(admin, 'report_update', { type: targetType, id }, handledAtSafe, {
          from: 'open',
          to: 'in_progress',
          adminNote: plan.adminNote,
        })
      }
    }

    return {
      id,
      reporter_id: reporter.id,
      target_type: targetPost ? 'post' : 'user',
      target_post_id: targetPost?.id ?? null,
      target_user_id: targetUser?.id ?? null,
      reason: plan.reason,
      detail: plan.detail,
      status: plan.status,
      admin_note: plan.adminNote,
      handled_by: admin ? must(admin).id : null,
      handled_at: handledAtSafe,
      created_at: createdAt,
      // 更新日時は「最後に対応した時刻」（未対応なら通報した時刻）
      updated_at: handledAtSafe ?? createdAt,
    }
  })

  auditLogs.sort(
    (a, b) =>
      toTime(a.created_at) - toTime(b.created_at) || String(a.id).localeCompare(String(b.id)),
  )

  return { reports, auditLogs, dailyActiveUsers: buildDailyActiveUsers(base, random, users) }
}

/** Date | string のどちらでも、ミリ秒に直す（監査ログの並び替え用） */
function toTime(value: Date | string | undefined): number {
  return value === undefined ? 0 : new Date(value).getTime()
}

/**
 * 日次の利用者（DAU）。直近 30 日分。
 * - alice・bob は毎日、carol はほぼ毎日、そのほかは平日に多く週末に少なく利用する
 * - 登録前・凍結後・管理者は含めない（eve は登録した日から）
 */
function buildDailyActiveUsers(
  base: Date,
  random: Random,
  users: SeedUser[],
): Insertable<DailyActiveUsers>[] {
  const rows: Insertable<DailyActiveUsers>[] = []
  const suspendedFrom = toDateString(daysBefore(base, DAVE_SUSPENDED_DAYS_AGO))

  for (let daysAgo = DAU_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const day = daysBefore(base, daysAgo)
    const date = toDateString(day)
    const isWeekend = [0, 6].includes(day.getUTCDay())

    for (const user of users) {
      if (user.role === 'admin') continue
      if (toDateString(user.createdAt) > date) continue // まだ登録していない
      if (user.handle === 'dave' && date >= suspendedFrom) continue // 凍結後はログインできない

      const probability =
        user.handle === 'alice' || user.handle === 'bob'
          ? 1
          : user.handle === 'carol'
            ? 0.8
            : isWeekend
              ? 0.3
              : 0.55
      if (random.chance(probability)) rows.push({ active_date: date, user_id: user.id })
    }
  }
  return rows
}
