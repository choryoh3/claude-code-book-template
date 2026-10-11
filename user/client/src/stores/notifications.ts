// 通知の store: 未読件数（左ナビのバッジ）と、リアルタイムに届いた新しい通知。
// Socket.IO の受信は composables/useRealtime.ts が担当し、受け取った内容をここに入れる。

import type { NotificationDto } from '@xclone/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notificationApi } from '@/api/endpoints'

/** バッジに出す上限（これを超えたら「99+」） */
const BADGE_MAX = 99

export const useNotificationStore = defineStore('notifications', () => {
  const unreadCount = ref(0)
  /** 通知画面を開いているあいだに届いた通知（画面の先頭に足す） */
  const incoming = ref<NotificationDto[]>([])

  const badgeLabel = computed(() => {
    if (unreadCount.value <= 0) return null
    return unreadCount.value > BADGE_MAX ? `${BADGE_MAX}+` : String(unreadCount.value)
  })

  /** サーバーから届いた新しい通知 */
  function receive(notification: NotificationDto) {
    incoming.value = [notification, ...incoming.value]
  }

  function setUnreadCount(count: number) {
    unreadCount.value = Math.max(0, count)
  }

  /** 未読件数を取り直す（起動時・再接続時） */
  async function refreshUnreadCount() {
    setUnreadCount((await notificationApi.unreadCount()).count)
  }

  /** すべて既読にする（通知画面を開いたとき） */
  async function markAllRead() {
    setUnreadCount((await notificationApi.markAllRead()).count)
  }

  /** 通知画面が、届いていた通知を取り込んだあとに呼ぶ */
  function takeIncoming(): NotificationDto[] {
    const items = incoming.value
    incoming.value = []
    return items
  }

  function reset() {
    unreadCount.value = 0
    incoming.value = []
  }

  return {
    unreadCount,
    incoming,
    badgeLabel,
    receive,
    setUnreadCount,
    refreshUnreadCount,
    markAllRead,
    takeIncoming,
    reset,
  }
})
