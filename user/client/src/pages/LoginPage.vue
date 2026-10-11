<script setup lang="ts">
// ログイン画面（画面仕様書 U-01）。
// 失敗の理由は区別しない（「メールまたはパスワードが正しくありません」。アカウントの有無を漏らさない）。
// 凍結中のアカウントは「このアカウントは凍結されています」と表示する。

import { Eye, EyeOff } from '@lucide/vue'
import { EMAIL_MAX_LENGTH, loginSchema, PASSWORD_MAX_LENGTH } from '@xclone/shared'
import { Button } from '@xclone/ui'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorText = ref<string | null>(null)

const canSubmit = computed(
  () => email.value.trim() !== '' && password.value !== '' && !isSubmitting.value,
)

/** ログイン後の移動先（ログインが必要な画面から来たときは、元の画面へ戻す。外部の URL には飛ばさない） */
function redirectTarget(): string {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/'
}

async function submit() {
  const parsed = loginSchema.safeParse({ email: email.value.trim(), password: password.value })
  if (!parsed.success) {
    errorText.value = parsed.error.issues[0]?.message ?? '入力を確認してください'
    return
  }

  isSubmitting.value = true
  errorText.value = null
  try {
    await auth.login(parsed.data)
    await router.replace(redirectTarget())
  } catch (error) {
    errorText.value = errorMessage(error)
    password.value = '' // 失敗したらパスワード欄だけを空にする（画面仕様書 U-01）
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <p class="text-4xl font-black" aria-hidden="true">𝕏</p>
      <h1 class="mt-6 text-3xl font-extrabold">ログイン</h1>

      <form class="mt-8 flex flex-col gap-4" novalidate @submit.prevent="submit">
        <p
          v-if="errorText"
          class="rounded-md bg-red-600/10 px-3 py-2 text-sm text-red-600"
          role="alert"
        >
          {{ errorText }}
        </p>

        <label class="block">
          <span class="text-sm text-text-muted">メールアドレス</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            :maxlength="EMAIL_MAX_LENGTH"
            required
            class="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-3 outline-none focus:border-accent"
          />
        </label>

        <label class="block">
          <span class="text-sm text-text-muted">パスワード</span>
          <span class="relative mt-1 block">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :maxlength="PASSWORD_MAX_LENGTH"
              required
              class="w-full rounded-md border border-border bg-transparent px-3 py-3 pr-12 outline-none focus:border-accent"
            />
            <button
              type="button"
              class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-text-muted hover:bg-surface-hover"
              :aria-label="showPassword ? 'パスワードを隠す' : 'パスワードを表示'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="size-5" aria-hidden="true" />
              <Eye v-else class="size-5" aria-hidden="true" />
            </button>
          </span>
        </label>

        <Button
          type="submit"
          size="lg"
          class="mt-2 w-full"
          :disabled="!canSubmit"
          :loading="isSubmitting"
        >
          ログイン
        </Button>
      </form>

      <p class="mt-8 text-text-muted">
        アカウントをお持ちでない場合は
        <RouterLink :to="{ name: 'signup' }" class="text-accent hover:underline">
          アカウントを作成
        </RouterLink>
      </p>
    </div>
  </main>
</template>
