import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { Settings } from '@/types'
import { persisted } from '@/db/persisted'
import { useTenantBundle } from '@/mock/tenants'

export const useSettingsStore = defineStore('settings', () => {
  const bundle = useTenantBundle()
  const { data: settings, commit } = persisted<Settings>('settings', () => ({ ...bundle.settings }))

  const tenant = computed(() => bundle.tenant)

  function update(patch: Partial<Settings>): void {
    settings.value = { ...settings.value, ...patch }
    commit()
  }

  return { settings, tenant, update }
})
