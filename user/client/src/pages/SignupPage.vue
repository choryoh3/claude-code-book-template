<script setup lang="ts">
// アカウント登録画面（画面仕様書 U-02）。登録に成功したら、そのままログイン状態でホームへ。
// - 入力の規則は shared の registerSchema（サーバーと同じ）。エラーは各項目の下に出す
// - ハンドル名は入力が止まって 500ms 後に、使えるかをサーバーに確認する（打つたびに問い合わせない）

import {
  DISPLAY_NAME_MAX_LENGTH,
  ERROR_CODES,
  HANDLE_MAX_LENGTH,
  handleSchema,
  registerSchema,
} from '@xclone/shared'
import { Button } from '@xclone/ui'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, errorMessage } from '@/api/client'
import { userApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/auth'

type Field = 'displayName' | 'handle' | 'email' | 'password'

/** 入力が止まってから、ハンドル名の確認を始めるまでの時間 */
const HANDLE_CHECK_DELAY_MS = 500

const auth = useAuthStore()
const router = useRouter()

const form = reactive<Record<Field, string>>({
  displayName: '',
  handle: '',
  email: '',
  password: '',
})
const fieldErrors = reactive<Partial<Record<Field, string>>>({})
const handleStatus = ref<'idle' | 'checking' | 'available' | 'taken'>('idle')
const isSubmitting = ref(false)
const errorText = ref<string | null>(null)

let handleTimer: ReturnType<typeof setTimeout> | undefined

/** ハンドル名が変わったら、少し待ってから使えるかを確認する */
watch(
  () => form.handle,
  (handle) => {
    clearTimeout(handleTimer)
    handleStatus.value = 'idle'
    if (!handleSchema.safeParse(handle).success) return
    handleTimer = setTimeout(async () => {
      handleStatus.value = 'checking'
      try {
        const { available } = await userApi.isHandleAvailable(handle)
        if (form.handle === handle) handleStatus.value = available ? 'available' : 'taken'
      } catch {
        handleStatus.value = 'idle' // 確認できなくても登録はできる（重複なら登録時にサーバーが教えてくれる）
      }
    }, HANDLE_CHECK_DELAY_MS)
  },
)
onBeforeUnmount(() => clearTimeout(handleTimer))

/** 項目ごとのエラーを、最初のメッセージだけ入れる（issues は Zod の検証結果。空ならエラーを消す） */
function setFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  for (const field of ['displayName', 'handle', 'email', 'password'] as const) {
    fieldErrors[field] = issues.find((issue) => issue.path[0] === field)?.message
  }
}

async function submit() {
  const parsed = registerSchema.safeParse({ ...form, email: form.email.trim() })
  if (!parsed.success) {
    setFieldErrors(parsed.error.issues)
    return
  }
  setFieldErrors([])
  isSubmitting.value = true
  errorText.value = null
  try {
    await auth.register(parsed.data)
    await router.replace({ name: 'home' })
  } catch (error) {
    // 重複は該当する項目の下に出す。それ以外は上部にまとめて出す
    if (error instanceof ApiError && error.code === ERROR_CODES.EMAIL_TAKEN)
      fieldErrors.email = error.message
    else if (error instanceof ApiError && error.code === ERROR_CODES.HANDLE_TAKEN)
      fieldErrors.handle = error.message
    else errorText.value = errorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}

const inputClass =
  'mt-1 w-full rounded-md border border-border bg-transparent px-3 py-3 outline-none focus:border-accent aria-[invalid=true]:border-red-600'
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">
      <p class="text-4xl font-black" aria-hidden="true">𝕏</p>
      <h1 class="mt-6 text-3xl font-extrabold">アカウントを作成</h1>

      <form class="mt-8 flex flex-col gap-4" novalidate @submit.prevent="submit">
        <p
          v-if="errorText"
          class="rounded-md bg-red-600/10 px-3 py-2 text-sm text-red-600"
          role="alert"
        >
          {{ errorText }}
        </p>

        <label class="block">
          <span class="text-sm text-text-muted">表示名</span>
          <input
            v-model="form.displayName"
            :maxlength="DISPLAY_NAME_MAX_LENGTH"
            :aria-invalid="!!fieldErrors.displayName"
            aria-describedby="error-displayName"
            :class="inputClass"
          />
          <span id="error-displayName" class="mt-1 block text-sm text-red-600">{{
            fieldErrors.displayName
          }}</span>
        </label>

        <label class="block">
          <span class="text-sm text-text-muted">ハンドル名（半角英数字と _ 、3〜15 文字）</span>
          <span class="relative block">
            <span class="absolute top-1/2 left-3 mt-0.5 -translate-y-1/2 text-text-muted">@</span>
            <input
              v-model="form.handle"
              :maxlength="HANDLE_MAX_LENGTH"
              autocomplete="username"
              :aria-invalid="!!fieldErrors.handle || handleStatus === 'taken'"
              aria-describedby="error-handle"
              class="pl-7"
              :class="inputClass"
            />
          </span>
          <span id="error-handle" class="mt-1 block text-sm" role="status">
            <span v-if="fieldErrors.handle" class="text-red-600">{{ fieldErrors.handle }}</span>
            <span v-else-if="handleStatus === 'checking'" class="text-text-muted">確認中…</span>
            <span v-else-if="handleStatus === 'available'" class="text-repost">使用できます</span>
            <span v-else-if="handleStatus === 'taken'" class="text-red-600"
              >すでに使われています</span
            >
          </span>
        </label>

        <label class="block">
          <span class="text-sm text-text-muted">メールアドレス</span>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            :aria-invalid="!!fieldErrors.email"
            aria-describedby="error-email"
            :class="inputClass"
          />
          <span id="error-email" class="mt-1 block text-sm text-red-600">{{
            fieldErrors.email
          }}</span>
        </label>

        <label class="block">
          <span class="text-sm text-text-muted">パスワード（8 文字以上、英字と数字を含む）</span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            :aria-invalid="!!fieldErrors.password"
            aria-describedby="error-password"
            :class="inputClass"
          />
          <span id="error-password" class="mt-1 block text-sm text-red-600">{{
            fieldErrors.password
          }}</span>
        </label>

        <Button type="submit" size="lg" class="mt-2 w-full" :loading="isSubmitting">
          登録する
        </Button>
      </form>

      <p class="mt-8 text-text-muted">
        すでにアカウントをお持ちの場合は
        <RouterLink :to="{ name: 'login' }" class="text-accent hover:underline">
          ログイン
        </RouterLink>
      </p>
    </div>
  </main>
</template>
