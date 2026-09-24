import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ensureTenantSeeded } from './db/seed'

ensureTenantSeeded()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
