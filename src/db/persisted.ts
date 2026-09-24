import { ref, type Ref } from 'vue'
import { load, save, removeByPrefix } from '@/lib/storage'
import { bootTenantSlug } from '@/mock/tenants'

// "Banco" do mock: cada coleção vive no localStorage da loja e é sincronizada
// entre abas pelo evento `storage` (cliente, cozinha, salão e caixa lado a lado).
// Com backend, cada `persisted` vira uma coleção do Firestore com onSnapshot.

const VERSION = 'v2'

export function tenantPrefix(): string {
  return `pdv:${VERSION}:${bootTenantSlug()}:`
}

export function persisted<T>(name: string, seed: () => T): { data: Ref<T>; commit: () => void } {
  const key      = tenantPrefix() + name
  const existing = load<T | null>(key, null)
  const data     = ref(existing ?? seed()) as Ref<T>
  if (existing === null) save(key, data.value)

  window.addEventListener('storage', (e) => {
    if (e.key !== key) return
    if (e.newValue === null) { window.location.reload(); return }   // dados resetados em outra aba
    try { data.value = JSON.parse(e.newValue) } catch { /* ignora escrita parcial */ }
  })

  return { data, commit: () => save(key, data.value) }
}

// Apaga os dados da loja e recarrega: o seed é recriado do zero
export function resetTenantData(): void {
  removeByPrefix(tenantPrefix())
  removeByPrefix(tenantPrefix(), sessionStorage)
  window.location.reload()
}
