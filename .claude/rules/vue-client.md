---
paths: ['**/client/**/*.vue', '**/client/**/*.ts']
---

# Vue クライアント規約

## コンポーネント

- `<script setup lang="ts">` のみ。Options API は使わない
- props / emits は型付きで宣言する。props を直接変更しない
- コンポーネントは表示に専念し、ロジックは `composables/`、状態は Pinia、通信は `api/` に置く
- 1 コンポーネント 200 行以内を目安に分割する

```vue
<!-- Good -->
<script setup lang="ts">
const props = defineProps<{ post: PostDto }>()
const emit = defineEmits<{ like: [postId: string] }>()
</script>
```

## ディレクトリ（各 client 共通）

```
src/
├── api/          # fetch ラッパー。型は @xclone/shared から
├── composables/  # useXxx（再利用ロジック）
├── stores/       # Pinia（useXxxStore）
├── pages/        # ルート単位。router から参照
├── components/   # 再利用 UI
└── router/
```

## Pinia

- setup store 形式（`defineStore('x', () => {...})`）
- サーバー状態の取得は store の action に集約。コンポーネントから直接 fetch しない
- 派生値は `computed`。同じ値を二重に保持しない

## 認証

- access token はメモリ（store）のみ。localStorage に保存しない
- 401 時は refresh を 1 回だけ試し、失敗したらログアウトする

## Bad 例

```ts
// 型なし・コンポーネント内で直接 fetch
const posts = ref([])
onMounted(async () => {
  posts.value = await (await fetch('/api/posts')).json()
})
```
