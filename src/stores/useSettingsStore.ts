import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import type { Settings } from '@/types'
import { firebaseEnabled, firestore } from '@/firebase'
import { useTenantBundle } from '@/mock/tenants'
import { tenantPath, tenantPrefix } from '@/db/tenant'
import { load, save } from '@/lib/storage'

export const useSettingsStore = defineStore('settings', () => {
  const bundle   = useTenantBundle()
  const tenant   = computed(() => bundle.tenant)
  // O objeto é atualizado no lugar (Object.assign): telas que guardaram a
  // referência continuam vendo a configuração atual
  const settings = ref<Settings>({ ...bundle.settings })
  let loaded: Promise<void> = Promise.resolve()

  if (firebaseEnabled) {
    loaded = new Promise((resolve) => {
      onSnapshot(doc(firestore!, tenantPath()), (snap) => {
        if (snap.exists()) Object.assign(settings.value, snap.data().settings)
        resolve()
      }, (err) => { console.error('[db] settings', err); resolve() })
    })
  } else {
    const key = tenantPrefix() + 'settings'
    Object.assign(settings.value, load<Settings | null>(key, null) ?? {})
    window.addEventListener('storage', (e) => {
      if (e.key === key && e.newValue) Object.assign(settings.value, JSON.parse(e.newValue))
    })
  }

  async function update(patch: Partial<Settings>): Promise<void> {
    Object.assign(settings.value, patch)
    if (firebaseEnabled) await updateDoc(doc(firestore!, tenantPath()), { settings: { ...settings.value } })
    else save(tenantPrefix() + 'settings', settings.value)
  }

  return { settings, tenant, update, ready: () => loaded }
})
