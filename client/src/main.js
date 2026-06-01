import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.min.js'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')

// 注册 PWA Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
