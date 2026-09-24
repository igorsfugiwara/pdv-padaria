import { firebaseEnabled, firestore } from '@/firebase'
import { useTenantBundle, bootTenantSlug } from '@/mock/tenants'
import { load, save, removeByPrefix } from '@/lib/storage'
import { tenantPrefix } from './tenant'
import { buildTenantSeed, type TenantSeed } from './seed-data'
import { resetTenant } from './firestore-seed'

// Modo mock: a loja nasce inteira no localStorage na primeira carga
let cached: TenantSeed | null = null

export function localSeed(): TenantSeed {
  if (!cached) cached = buildTenantSeed(useTenantBundle())
  return cached
}

export function ensureTenantSeeded(): void {
  if (firebaseEnabled || !bootTenantSlug()) return
  const prefix = tenantPrefix()
  if (load<boolean>(prefix + 'seeded', false)) return

  removeByPrefix(prefix)
  const seed = localSeed()
  const bundle = useTenantBundle()
  save(prefix + 'settings', seed.settings)
  // no modo mock o PIN fica junto do usuário
  save(prefix + 'staff', bundle.staff)
  for (const [name, list] of Object.entries(seed.collections)) {
    if (name !== 'staff' && name !== 'staffPins') save(prefix + name, list)
  }
  save(prefix + 'seeded', true)
}

// Botão "Recriar dados de exemplo"
export async function resetTenantData(): Promise<void> {
  if (firebaseEnabled) {
    const bundle = useTenantBundle()
    await resetTenant(firestore!, bundle.tenant, buildTenantSeed(bundle))
  } else {
    removeByPrefix(tenantPrefix())
  }
  removeByPrefix(tenantPrefix(), sessionStorage)
  window.location.reload()
}
