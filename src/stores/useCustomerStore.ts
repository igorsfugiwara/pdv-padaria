import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { checkComanda, type ComandaCheck } from '@/lib/comanda'
import { load, save, remove } from '@/lib/storage'
import { tenantPrefix } from '@/db/persisted'
import { useComandasStore } from './useComandasStore'
import { useSettingsStore } from './useSettingsStore'

// A comanda ativa neste celular. É o "login" do cliente: sem ela não há pedido.
export const useCustomerStore = defineStore('customer', () => {
  const KEY = tenantPrefix() + 'customer-session'
  const comandas  = useComandasStore()
  const sessionId = ref<string | null>(load<string | null>(KEY, null))

  const session  = computed(() => (sessionId.value ? comandas.byId.get(sessionId.value) ?? null : null))
  const isActive = computed(() => session.value?.status === 'open')
  // o caixa fechou a conta enquanto o cliente estava com o app aberto
  const wasClosed = computed(() => !!session.value && session.value.status !== 'open')

  function activate(raw: string): ComandaCheck {
    const result = checkComanda(raw, useSettingsStore().settings)
    if (result.ok) {
      const s = comandas.openSession(result.number, 'cliente')
      sessionId.value = s.id
      save(KEY, s.id)
    }
    return result
  }

  function setName(name: string): void {
    if (session.value) comandas.setCustomerName(session.value.id, name)
  }

  function release(): void {
    sessionId.value = null
    remove(KEY)
  }

  return { sessionId, session, isActive, wasClosed, activate, setName, release }
})
