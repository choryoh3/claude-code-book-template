// Socket.IO でサーバーとつながり、通知をリアルタイムに受け取る composable（skill: realtime-socket）。
//
// - 接続は 1 つだけ（App.vue で 1 回呼ぶ）。ログインしたらつなぎ、ログアウトしたら切る
// - access token が更新されたら、新しい token でつなぎ直す（古い token は 15 分で期限が切れるため）
// - つながり直したときは、未読件数を取り直す（切れていた間の通知の取りこぼしを補う）

import type { ClientToServerEvents, ServerToClientEvents } from '@xclone/shared'
import type { Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@xclone/shared'
import { io } from 'socket.io-client'
import { onScopeDispose, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function useRealtime() {
  const auth = useAuthStore()
  const notifications = useNotificationStore()
  let socket: RealtimeSocket | null = null

  function disconnect() {
    socket?.disconnect()
    socket = null
  }

  function connect(token: string) {
    disconnect()
    // 同じオリジンの /socket.io へ接続する（開発中は Vite が user/server へ転送する）
    const next: RealtimeSocket = io({ auth: { token }, transports: ['websocket', 'polling'] })
    next.on(SOCKET_EVENTS.NOTIFICATION_NEW, ({ notification }) =>
      notifications.receive(notification),
    )
    next.on(SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT, ({ count }) =>
      notifications.setUnreadCount(count),
    )
    next.on('connect', () => {
      notifications.refreshUnreadCount().catch(() => {}) // 取れなくても、次のイベントで更新される
    })
    socket = next
  }

  watch(
    () => auth.accessToken,
    (token) => {
      if (token) connect(token)
      else {
        disconnect()
        notifications.reset()
      }
    },
    { immediate: true },
  )

  onScopeDispose(disconnect)
}
