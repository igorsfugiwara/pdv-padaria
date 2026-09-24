import { useTenantBundle, bootTenantSlug } from '@/mock/tenants'
import { buildLiveSeed, type LiveSeed } from '@/mock/seed-live'
import { load, save, removeByPrefix } from '@/lib/storage'
import { tenantPrefix } from './persisted'

// O "dia de hoje" precisa nascer inteiro de uma vez: comandas, pedidos e caixa
// se referem uns aos outros por id. Semear coleção por coleção (na primeira vez
// que cada tela usa uma) misturaria gerações diferentes entre abas.
export function ensureTenantSeeded(): void {
  if (!bootTenantSlug()) return
  const prefix = tenantPrefix()
  if (load<boolean>(prefix + 'seeded', false)) return

  removeByPrefix(prefix)                       // restos de um seed parcial
  const bundle   = useTenantBundle()
  const products = bundle.seedProducts()
  const insumos  = bundle.seedInsumos()
  const live     = buildLiveSeed(products, insumos)
  cached = live

  const collections: Record<string, unknown> = {
    'settings':         { ...bundle.settings },
    'staff':            bundle.staff,
    'products':         products,
    'insumos':          insumos,
    'stock-moves':      live.stockMoves,
    'comandas':         live.comandas,
    'orders':           live.orders,
    'cashier-sessions': live.cashierSessions,
    'cash-movements':   live.movements,
  }
  Object.entries(collections).forEach(([name, value]) => save(prefix + name, value))
  save(prefix + 'seeded', true)
}

// Fallback das coleções (ex.: localStorage indisponível): mesmo seed da carga
let cached: LiveSeed | null = null

export function liveSeed(): LiveSeed {
  if (!cached) {
    const bundle = useTenantBundle()
    cached = buildLiveSeed(bundle.seedProducts(), bundle.seedInsumos())
  }
  return cached
}
