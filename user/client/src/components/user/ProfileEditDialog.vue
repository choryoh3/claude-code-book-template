<script setup lang="ts">
// プロフィール編集ダイアログ（画面仕様書 U-06）。表示名・自己紹介・アイコン・ヘッダー画像を変更する。
// - 入力は shared の updateProfileSchema で検証（サーバーと同じ規則）
// - 画像は選んだらすぐアップロードして、URL を保存の対象にする
// - 変更したまま閉じようとしたら、破棄してよいか確認する

import type { UserProfileDto } from '@xclone/shared'
import { Camera } from '@lucide/vue'
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, updateProfileSchema } from '@xclone/shared'
import { Avatar, Button, Dialog } from '@xclone/ui'
import { computed, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { mediaApi, userApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/auth'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ profile: UserProfileDto }>()
const emit = defineEmits<{ saved: [profile: UserProfileDto] }>()
const open = defineModel<boolean>('open', { default: false })

const auth = useAuthStore()
const toast = useToastStore()
const confirmDialog = useConfirmStore()

const displayName = ref('')
const bio = ref('')
const avatarUrl = ref<string | null>(null)
const headerUrl = ref<string | null>(null)
const isSaving = ref(false)
const isUploading = ref(false)
const errorText = ref<string | null>(null)

/** 開くたびに、今のプロフィールの値を入力欄に入れる */
watch(open, (isOpen) => {
  if (!isOpen) return
  displayName.value = props.profile.displayName
  bio.value = props.profile.bio
  avatarUrl.value = props.profile.avatarUrl
  headerUrl.value = props.profile.headerUrl
  errorText.value = null
})

const isDirty = computed(
  () =>
    displayName.value !== props.profile.displayName ||
    bio.value !== props.profile.bio ||
    avatarUrl.value !== props.profile.avatarUrl ||
    headerUrl.value !== props.profile.headerUrl,
)

/** 閉じる前の確認（変更があれば「破棄しますか？」と聞き、「破棄」を選んだときだけ閉じる） */
const dialogOpen = computed({
  get: () => open.value,
  set: (value) => {
    if (value || !isDirty.value || isSaving.value) {
      open.value = value
      return
    }
    confirmDialog
      .ask({
        title: '変更を破棄しますか？',
        message: '保存していない変更は失われます。',
        confirmLabel: '破棄',
        danger: true,
      })
      .then((discard) => {
        if (discard) open.value = false
      })
  },
})

async function upload(event: Event, target: 'avatar' | 'header') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  isUploading.value = true
  try {
    const url = await mediaApi.upload(file)
    if (target === 'avatar') avatarUrl.value = url
    else headerUrl.value = url
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    isUploading.value = false
  }
}

async function save() {
  const parsed = updateProfileSchema.safeParse({
    displayName: displayName.value,
    bio: bio.value,
    avatarUrl: avatarUrl.value,
    headerUrl: headerUrl.value,
  })
  if (!parsed.success) {
    errorText.value = parsed.error.issues[0]?.message ?? '入力を確認してください'
    return
  }

  isSaving.value = true
  try {
    const saved = await userApi.updateMe(parsed.data)
    auth.updateUser({ displayName: saved.displayName, avatarUrl: saved.avatarUrl })
    emit('saved', saved)
    open.value = false
    toast.success('プロフィールを更新しました')
  } catch (error) {
    errorText.value = errorMessage(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="dialogOpen" title="プロフィールを編集">
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <!-- ヘッダー画像とアイコン（クリックで変更） -->
      <div class="relative">
        <label
          class="block aspect-[3/1] cursor-pointer overflow-hidden rounded-card bg-surface-hover"
        >
          <img
            v-if="headerUrl"
            :src="headerUrl"
            alt="ヘッダー画像"
            class="size-full object-cover"
          />
          <span class="sr-only">ヘッダー画像を変更</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="upload($event, 'header')"
          />
        </label>
        <label class="absolute -bottom-8 left-4 cursor-pointer rounded-full ring-4 ring-surface">
          <Avatar :src="avatarUrl" :name="displayName || profile.displayName" size="lg" />
          <span
            class="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white"
          >
            <Camera class="size-6" aria-hidden="true" />
          </span>
          <span class="sr-only">アイコンを変更</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="upload($event, 'avatar')"
          />
        </label>
      </div>

      <label class="mt-8 block">
        <span class="text-sm text-text-muted">表示名</span>
        <input
          v-model="displayName"
          :maxlength="DISPLAY_NAME_MAX_LENGTH"
          required
          class="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      <label class="block">
        <span class="flex justify-between text-sm text-text-muted">
          <span>自己紹介</span>
          <span>{{ bio.length }} / {{ BIO_MAX_LENGTH }}</span>
        </span>
        <textarea
          v-model="bio"
          :maxlength="BIO_MAX_LENGTH"
          rows="3"
          class="mt-1 w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      <p v-if="errorText" class="text-sm text-red-600" role="alert">
        {{ errorText }}
      </p>
    </form>

    <template #footer>
      <Button :disabled="!isDirty || isUploading" :loading="isSaving" @click="save"> 保存 </Button>
    </template>
  </Dialog>
</template>
