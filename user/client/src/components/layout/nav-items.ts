// 左のサイドナビと、スマホの下部タブバーで共通に使うメニュー項目。

import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Bell, Bookmark, Home, Search, User } from '@lucide/vue'

export interface NavItem {
  label: string
  icon: Component
  to: RouteLocationRaw
  /** 通知のバッジを出す項目か */
  showsBadge?: boolean
}

/** handle はログイン中の自分のハンドル（プロフィールへのリンクに使う） */
export function buildNavItems(handle: string | undefined): NavItem[] {
  const items: NavItem[] = [
    { label: 'ホーム', icon: Home, to: { name: 'home' } },
    { label: '話題を検索', icon: Search, to: { name: 'search' } },
    { label: '通知', icon: Bell, to: { name: 'notifications' }, showsBadge: true },
    { label: 'ブックマーク', icon: Bookmark, to: { name: 'bookmarks' } },
  ]
  if (handle)
    items.push({ label: 'プロフィール', icon: User, to: { name: 'profile', params: { handle } } })
  return items
}
