import type {
  CashierSession, CashMovement, ComandaSession, Insumo, NfceDoc, Order, Product, Settings, StaffUser, StockMove,
} from '@/types'
import { orderSubtotal } from '@/mock/build'
import type { TenantBundle } from '@/mock/tenants'
import { buildLiveSeed } from '@/mock/seed-live'
import { indexInsumos, defaultChoices, fullRecipe } from '@/lib/recipe'

// Dados completos de uma loja de demonstração, montados de uma vez (as coleções
// se referem umas às outras por id). Puro: roda no navegador e no script de seed.

export interface Counter { id: string; day?: string; seq: number }
export interface OpenComanda { id: string; sessionId: string }
export interface StaffPin { id: string; pin: string }

export interface TenantSeed {
  settings: Settings
  collections: {
    products: Product[]
    insumos: Insumo[]
    stockMoves: StockMove[]
    comandas: ComandaSession[]
    openComandas: OpenComanda[]
    orders: Order[]
    cashierSessions: CashierSession[]
    cashMovements: CashMovement[]
    counters: Counter[]
    staff: StaffUser[]
    staffPins: StaffPin[]
    nfce: NfceDoc[]
  }
}

export function dayKey(d = new Date()): string {
  return d.toLocaleDateString('sv-SE')     // AAAA-MM-DD no fuso local
}

// Produto sem insumo suficiente para 1 unidade da receita base
function stockOut(p: Product, insumos: ReturnType<typeof indexInsumos>): boolean {
  return fullRecipe(p, defaultChoices(p)).some((l) => (insumos.get(l.insumoId)?.stock ?? 0) < l.qty)
}

export function buildTenantSeed(bundle: TenantBundle): TenantSeed {
  const insumos  = bundle.seedInsumos()
  const index    = indexInsumos(insumos)
  const products = bundle.seedProducts().map((p) => ({ ...p, stockOut: stockOut(p, index) }))
  const live     = buildLiveSeed(products, insumos)

  // Pedidos que já passaram do "recebido" já consumiram insumos
  live.orders.forEach((o) => { if (o.status !== 'received') o.consumedAt = o.startedAt ?? o.createdAt })
  live.comandas.forEach((c) => { c.orderIds = live.orders.filter((o) => o.comandaId === c.id).map((o) => o.id) })

  // Notas das comandas já pagas hoje (modo simulado), ligadas ao pagamento
  const nfce: NfceDoc[] = []
  for (const c of live.comandas) {
    const n = c.payment?.nfce
    if (!n) continue
    const total = live.orders.filter((o) => o.comandaId === c.id).reduce((s, o) => s + orderSubtotal(o), 0)
    nfce.push({
      id: c.id, comandaId: c.id, comandaNumber: c.number, status: 'autorizada', provider: 'simulado', ambiente: 'simulado',
      total, numero: n.number, serie: n.series, chave: n.key, criadaEm: n.issuedAt, autorizadaEm: n.issuedAt,
      tentativas: 1, operador: c.payment!.operator,
    })
    Object.assign(n, { ref: c.id, status: 'autorizada', ambiente: 'simulado' })
  }

  const today = dayKey()
  const lastOrder = live.orders.reduce((m, o) => Math.max(m, o.number), 0)
  const lastNfce  = live.comandas.reduce((m, c) => Math.max(m, c.payment?.nfce?.number ?? 0), 0)

  return {
    settings: { ...bundle.settings },
    collections: {
      products,
      insumos,
      stockMoves:      live.stockMoves,
      comandas:        live.comandas,
      openComandas:    live.comandas.filter((c) => c.status === 'open' && !c.number.startsWith('V')).map((c) => ({ id: c.number, sessionId: c.id })),
      orders:          live.orders,
      cashierSessions: live.cashierSessions,
      cashMovements:   live.movements,
      counters: [
        { id: 'orders', day: today, seq: lastOrder },
        { id: 'nfce',   seq: lastNfce },
        { id: 'vendas', day: today, seq: 0 },
      ],
      staff:     bundle.staff.map(({ pin: _pin, ...u }) => u),
      staffPins: bundle.staff.map((u) => ({ id: u.id, pin: u.pin! })),
      nfce,
    },
  }
}
