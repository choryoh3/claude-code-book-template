<script setup lang="ts">
// 投稿フォーム（ホーム上部・投稿ダイアログ・投稿詳細の返信欄で共通）。
// - 本文は 280 文字まで（リングのカウンタ）。画像は 4 枚まで（選んだらすぐアップロードして、プレビューを出す）
// - 送信前に shared の createPostSchema で検証する（サーバーと同じ規則なので、送る前に気づける）
// - 送信中・空・上限超えのときは投稿ボタンを押せない（二重送信の防止）

import type { PostDto, PostSummaryDto } from '@xclone/shared'
import { ImagePlus, X } from '@lucide/vue'
import {
  ALLOWED_IMAGE_TYPES,
  createPostSchema,
  MAX_POST_LENGTH,
  MAX_POST_MEDIA,
} from '@xclone/shared'
import { Avatar, Button } from '@xclone/ui'
import { computed, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { mediaApi, postApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import CharCounter from './CharCounter.vue'
import QuotedPost from './QuotedPost.vue'

const props = withDefaults(
  defineProps<{
    /** 返信先（返信フォームのとき） */
    replyTo?: PostDto | null
    /** 引用元（引用のとき） */
    quote?: PostSummaryDto | null
    placeholder?: string
    /** 最初から入力欄にフォーカスする（ダイアログで開いたとき） */
    autofocus?: boolean
  }>(),
  { replyTo: null, quote: null, placeholder: 'いまどうしてる？', autofocus: false },
)
const emit = defineEmits<{ posted: [post: PostDto] }>()

const auth = useAuthStore()
const toast = useToastStore()

const content = ref('')
const mediaUrls = ref<string[]>([])
const isUploading = ref(false)
const isSubmitting = ref(false)
const errorText = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

/** 文字数（サーバーの検証（Zod の max）と同じ数え方にする） */
const count = computed(() => content.value.length)
const hasBody = computed(() => content.value.trim().length > 0 || mediaUrls.value.length > 0)
const canSubmit = computed(
  () =>
    hasBody.value && count.value <= MAX_POST_LENGTH && !isUploading.value && !isSubmitting.value,
)
const canAddImage = computed(() => mediaUrls.value.length < MAX_POST_MEDIA && !isUploading.value)

/** 選んだ画像を、上限の枚数まで順にアップロードする */
async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).slice(0, MAX_POST_MEDIA - mediaUrls.value.length)
  input.value = '' // 同じファイルをもう一度選べるようにする
  if (files.length === 0) return

  isUploading.value = true
  try {
    for (const file of files) mediaUrls.value = [...mediaUrls.value, await mediaApi.upload(file)]
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    isUploading.value = false
  }
}

function removeImage(url: string) {
  mediaUrls.value = mediaUrls.value.filter((item) => item !== url)
}

async function submit() {
  const parsed = createPostSchema.safeParse({
    content: content.value,
    mediaUrls: mediaUrls.value,
    replyToId: props.replyTo?.id,
    quoteOfId: props.quote?.id,
  })
  if (!parsed.success) {
    errorText.value = parsed.error.issues[0]?.message ?? '入力を確認してください'
    return
  }

  isSubmitting.value = true
  errorText.value = null
  try {
    const post = await postApi.create(parsed.data)
    content.value = ''
    mediaUrls.value = []
    emit('posted', post)
  } catch (error) {
    // 入力は消さずに残す（もう一度送れるように）
    toast.error(`投稿に失敗しました: ${errorMessage(error)}`)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="flex gap-3" @submit.prevent="submit">
    <Avatar
      v-if="auth.user"
      :src="auth.user.avatarUrl"
      :name="auth.user.displayName"
      class="shrink-0"
    />
    <div class="min-w-0 flex-1">
      <p v-if="replyTo" class="mb-1 text-sm text-text-muted">
        返信先: <span class="text-accent">@{{ replyTo.author.handle }}</span>
      </p>
      <textarea
        v-model="content"
        :placeholder="placeholder"
        :autofocus="autofocus"
        rows="2"
        aria-label="投稿の本文"
        class="w-full resize-none bg-transparent py-2 text-xl outline-none placeholder:text-text-muted"
        @input="errorText = null"
      />

      <QuotedPost v-if="quote" :post="quote" />

      <!-- 添付した画像のプレビュー（× で外せる） -->
      <ul v-if="mediaUrls.length > 0" class="mt-2 grid grid-cols-2 gap-2">
        <li v-for="(url, index) in mediaUrls" :key="url" class="relative">
          <img
            :src="url"
            :alt="`添付画像 ${index + 1}`"
            class="aspect-video w-full rounded-card object-cover"
          />
          <button
            type="button"
            class="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white"
            :aria-label="`添付画像 ${index + 1} を外す`"
            @click="removeImage(url)"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <p v-if="errorText" class="mt-2 text-sm text-red-600" role="alert">
        {{ errorText }}
      </p>

      <div class="mt-2 flex items-center justify-between border-t border-border pt-2">
        <div>
          <input
            ref="fileInput"
            type="file"
            :accept="ALLOWED_IMAGE_TYPES.join(',')"
            multiple
            class="hidden"
            @change="onFilesSelected"
          />
          <button
            type="button"
            class="rounded-full p-2 text-accent hover:bg-accent/10 disabled:opacity-40"
            :disabled="!canAddImage"
            :aria-label="`画像を追加（${MAX_POST_MEDIA}枚まで）`"
            @click="fileInput?.click()"
          >
            <ImagePlus class="size-5" aria-hidden="true" />
          </button>
          <span v-if="isUploading" class="ml-2 text-sm text-text-muted" role="status"
            >アップロード中…</span
          >
        </div>
        <div class="flex items-center gap-3">
          <CharCounter v-if="count > 0" :count="count" :max="MAX_POST_LENGTH" />
          <Button type="submit" size="sm" :disabled="!canSubmit" :loading="isSubmitting">
            {{ replyTo ? '返信' : 'ポストする' }}
          </Button>
        </div>
      </div>
    </div>
  </form>
</template>
