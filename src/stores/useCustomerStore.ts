import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { checkComanda, type ComandaCheck } from '@/lib/comanda'
import { load, save, remove } from '@/lib/storage'
import { tenantPrefix } from '@/db/tenant'
import { dbContext } from '@/db/context'
import { useComandasStore } from './useComandasStore'
import { useSettingsStore } from './useSettingsStore'

// A comanda ativa neste celular. É o "login" do cliente: sem ela não há pedido.
export const useCustomerStore = defineStore('customer', () => {
  const KEY = tenantPrefix() + 'customer-session'
  const comandas  = useComandasStore()
  const sessionId = ref<string | null>(load<string | null>(KEY, null))
  dbContext.customerSessionId = sessionId.value

  const session  = computed(() => (sessionId.value ? comandas.byId.get(sessionId.value) ?? null : null))
  const isActive = computed(() => session.value?.status === 'open')
  // o caixa fechou a conta enquanto o cliente estava com o app aberto
  const wasClosed = computed(() => !!session.value && session.value.status !== 'open')

  // Os pedidos do cliente são assinados um a um, pelos ids guardados na comanda
  watch(() => session.value?.orderIds ?? [], (ids) => {
    if (ids.join() !== dbContext.customerOrderIds.join()) dbContext.customerOrderIds = [...ids]
  }, { immediate: true })

  function setSession(id: string | null) {
    sessionId.value = id
    dbContext.customerSessionId = id
    if (id) save(KEY, id)
    else remove(KEY)
  }

  async function activate(raw: string): Promise<ComandaCheck> {
    const result = checkComanda(raw, useSettingsStore().settings)
    if (result.ok) {
      const s = await comandas.openSession(result.number, 'cliente')
      setSession(s.id)
      await comandas.ready()
    }
    return result
  }

  async function setName(name: string): Promise<void> {
    if (session.value) await comandas.setCustomerName(session.value.id, name)
  }

  function release(): void {
    setSession(null)
  }

  // Na carga da página, espera a comanda salva chegar antes de decidir a rota
  async function resolve(): Promise<void> {
    if (sessionId.value) await comandas.ready()
  }

  return { sessionId, session, isActive, wasClosed, activate, setName, release, resolve }
})
