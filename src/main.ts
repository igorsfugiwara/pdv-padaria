import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ensureTenantSeeded } from './db/seed'
import { initFirebaseAuth } from './firebase'
import { bootTenantSlug } from './mock/tenants'

async function start() {
  ensureTenantSeeded()                       // modo mock
  if (bootTenantSlug()) {
    try {
      await initFirebaseAuth()               // login anônimo antes de qualquer leitura
    } catch (err) {
      console.error('[firebase] login anônimo falhou', err)
    }
  }

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

start()
