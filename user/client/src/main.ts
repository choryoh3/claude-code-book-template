// 画面（Vue アプリ）の起動。Pinia（状態管理）とルーターを組み込んで、#app に表示する。

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
