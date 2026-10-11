<script setup lang="ts">
// プロフィール（画面仕様書 U-05）。ヘッダー画像・アイコン・名前・自己紹介・フォロー数と、
// 「投稿 / 返信 / メディア / いいね」のタブ。自分なら「プロフィールを編集」、他人なら「フォロー」ボタン。

import type { UserProfileDto } from '@xclone/shared'
import type { ProfileTab } from '@/api/endpoints'
import { CalendarDays, Ellipsis, Flag } from '@lucide/vue'
import { ERROR_CODES } from '@xclone/shared'
import { Avatar, Button } from '@xclone/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, errorMessage } from '@/api/client'
import { userApi } from '@/api/endpoints'
import ListStatus from '@/components/common/ListStatus.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import TabBar from '@/components/common/TabBar.vue'
import PostList from '@/components/post/PostList.vue'
import ProfileEditDialog from '@/components/user/ProfileEditDialog.vue'
import { usePostList } from '@/composables/usePostList'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'posts', label: 'ポスト' },
  { value: 'replies', label: '返信' },
  { value: 'media', label: 'メディア' },
  { value: 'likes', label: 'いいね' },
]
const EMPTY_TEXTS: Record<ProfileTab, string> = {
  posts: 'まだ投稿がありません',
  replies: 'まだ返信がありません',
  media: 'まだ画像の投稿がありません',
  likes: 'まだいいねした投稿がありません',
}

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const ui = useUiStore()
const handle = String(route.params.handle)

const profile = ref<UserProfileDto | null>(null)
const isLoading = ref(true)
const errorText = ref<string | null>(null)
const isEditOpen = ref(false)
const isFollowBusy = ref(false)
const isMenuOpen = ref(false)

const tab = computed<ProfileTab>({
  get: () => TABS.find((item) => item.value === route.query.tab)?.value ?? 'posts',
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
})

const list = usePostList((cursor) => userApi.posts(handle, tab.value, { cursor }))

async function load() {
  isLoading.value = true
  errorText.value = null
  try {
    profile.value = await userApi.profile(handle)
    if (!profile.value.isSuspended) await list.reload()
  } catch (error) {
    errorText.value =
      error instanceof ApiError && error.code === ERROR_CODES.USER_NOT_FOUND
        ? 'このアカウントは存在しません'
        : errorMessage(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(load)
watch(tab, list.reload)

/** 登録した年月（例 2026年10月から利用しています） */
const joinedLabel = computed(() => {
  if (!profile.value) return ''
  const date = new Date(profile.value.createdAt)
  return `${date.getFullYear()}年${date.getMonth() + 1}月から利用しています`
})

/** フォロー / フォロー解除（結果のプロフィールで、フォロワー数も更新する） */
async function toggleFollow() {
  if (!profile.value) return
  isFollowBusy.value = true
  try {
    profile.value = profile.value.isFollowing
      ? await userApi.unfollow(handle)
      : await userApi.follow(handle)
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    isFollowBusy.value = false
  }
}

function report() {
  isMenuOpen.value = false
  if (profile.value)
    ui.openReport({ type: 'user', id: profile.value.id, label: `@${profile.value.handle} さん` })
}
</script>

<template>
  <PageHeader
    :title="profile?.displayName ?? `@${handle}`"
    :subtitle="profile && !profile.isSuspended ? `${profile.postCount} 件のポスト` : undefined"
    show-back
  />

  <ListStatus
    :is-loading="isLoading"
    :error-text="errorText"
    :is-empty="false"
    empty-text=""
    is-first-load
    @retry="load"
  />

  <template v-if="profile && !isLoading">
    <!-- 凍結中のアカウントは中身を出さない（画面仕様書 U-05） -->
    <p v-if="profile.isSuspended" class="px-4 py-10 text-center font-bold" role="status">
      このアカウントは凍結されています
    </p>

    <template v-else>
      <section aria-label="プロフィール">
        <div class="aspect-[3/1] bg-surface-hover">
          <img
            v-if="profile.headerUrl"
            :src="profile.headerUrl"
            alt=""
            class="size-full object-cover"
          />
        </div>

        <div class="px-4">
          <div class="flex items-start justify-between">
            <Avatar
              :src="profile.avatarUrl"
              :name="profile.displayName"
              size="lg"
              class="-mt-10 size-[5.5rem] text-4xl ring-4 ring-surface sm:-mt-16 sm:size-32"
            />
            <div class="mt-3 flex items-center gap-2">
              <div v-if="!profile.isSelf" class="relative">
                <button
                  type="button"
                  class="rounded-full border border-border p-2 hover:bg-surface-hover"
                  aria-label="その他の操作"
                  aria-haspopup="menu"
                  :aria-expanded="isMenuOpen"
                  @click="isMenuOpen = !isMenuOpen"
                >
                  <Ellipsis class="size-5" aria-hidden="true" />
                </button>
                <div
                  v-if="isMenuOpen"
                  role="menu"
                  class="absolute top-full right-0 z-10 mt-1 w-56 overflow-hidden rounded-card border border-border bg-surface shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-hover"
                    @click="report"
                  >
                    <Flag class="size-5" aria-hidden="true" /> @{{ profile.handle }} さんを通報
                  </button>
                </div>
              </div>

              <Button v-if="profile.isSelf" variant="secondary" @click="isEditOpen = true">
                プロフィールを編集
              </Button>
              <Button
                v-else
                :variant="profile.isFollowing ? 'secondary' : 'primary'"
                :loading="isFollowBusy"
                class="group min-w-28"
                @click="toggleFollow"
              >
                <template v-if="profile.isFollowing">
                  <span class="group-hover:hidden">フォロー中</span>
                  <span class="hidden text-red-600 group-hover:inline">フォロー解除</span>
                </template>
                <template v-else> フォロー </template>
              </Button>
            </div>
          </div>

          <h2 class="mt-3 text-xl font-extrabold">
            {{ profile.displayName }}
          </h2>
          <p class="text-text-muted">@{{ profile.handle }}</p>
          <p v-if="profile.bio" class="mt-3 whitespace-pre-wrap">
            {{ profile.bio }}
          </p>
          <p class="mt-3 flex items-center gap-1 text-text-muted">
            <CalendarDays class="size-4" aria-hidden="true" /> {{ joinedLabel }}
          </p>
          <p class="mt-3 flex gap-5">
            <RouterLink
              :to="{ name: 'follows', params: { handle, direction: 'following' } }"
              class="hover:underline"
            >
              <span class="font-bold">{{ profile.followingCount }}</span>
              <span class="text-text-muted">フォロー中</span>
            </RouterLink>
            <RouterLink
              :to="{ name: 'follows', params: { handle, direction: 'followers' } }"
              class="hover:underline"
            >
              <span class="font-bold">{{ profile.followerCount }}</span>
              <span class="text-text-muted">フォロワー</span>
            </RouterLink>
          </p>
        </div>
      </section>

      <div class="mt-3 border-b border-border">
        <TabBar v-model="tab" :tabs="TABS" />
      </div>

      <PostList :list="list" :empty-text="EMPTY_TEXTS[tab]" />

      <ProfileEditDialog
        v-if="profile.isSelf"
        v-model:open="isEditOpen"
        :profile="profile"
        @saved="profile = $event"
      />
    </template>
  </template>
</template>
