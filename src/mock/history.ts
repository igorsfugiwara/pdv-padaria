import type { ComandaSession, Destination, Insumo, Order, PaymentMethod, Product, Settings } from '@/types'
import { createRandom, hashString, type Random } from '@/lib/random'
import { indexInsumos } from '@/lib/recipe'
import { startOfDay } from '@/lib/format'
import { buildItem, choicesFor, orderSubtotal } from './build'

// Histórico dos últimos dias para relatórios. Não vai para o armazenamento: é
// gerado de forma determinística a partir da loja e da data, então sai igual a
// cada carga e não pesa no localStorage.

export interface History {
  comandas: ComandaSession[]
  orders:   Order[]
}

const HOURS: [number, number][] = [
  [6, 3], [7, 9], [8, 10], [9, 7], [10, 4], [11, 5], [12, 9], [13, 8],
  [14, 4], [15, 4], [16, 6], [17, 6], [18, 4], [19, 3], [20, 2],
]

function categoryWeights(hour: number): [string, number][] {
  if (hour < 11) return [['chapa', 5], ['paes', 4], ['cafes', 6], ['bebidas', 2], ['doces', 1], ['salgados', 1]]
  if (hour < 15) return [['pratos', 6], ['chapa', 2], ['bebidas', 4], ['salgados', 2], ['cafes', 2], ['doces', 2]]
  return [['cafes', 5], ['doces', 4], ['salgados', 4], ['paes', 3], ['chapa', 2], ['bebidas', 2]]
}

const METHODS: [PaymentMethod, number][] = [['pix', 36], ['credito', 20], ['debito', 24], ['dinheiro', 10], ['voucher', 10]]

// Minutos de preparo por estação (mín, máx)
const PREP: Record<string, [number, number]> = { cozinha: [5, 12], cafe: [2, 6], balcao: [1, 3] }

function randomChoiceIds(p: Product, rnd: Random): string[] {
  const ids: string[] = []
  for (const g of p.options ?? []) {
    if (g.required && g.max === 1) ids.push(rnd.pick(g.choices).id)
    else if (rnd.chance(0.3)) ids.push(rnd.pick(g.choices).id)
  }
  return ids
}

function randomDestination(rnd: Random, tables: number): Destination {
  const kind = rnd.weighted<Destination['type']>([['mesa', 70], ['balcao', 18], ['viagem', 12]])
  return kind === 'mesa' ? { type: 'mesa', table: rnd.int(1, tables) } : { type: kind }
}

let cache: { key: string; value: History } | null = null

export function getHistory(
  slug: string,
  products: Product[],
  insumosList: Insumo[],
  settings: Settings,
  days = 30,
): History {
  const today = startOfDay()
  const key   = `${slug}:${today.toDateString()}:${days}`
  if (cache?.key === key) return cache.value

  const insumos  = indexInsumos(insumosList)
  const active   = products.filter((p) => p.active)
  const byCat    = new Map<string, Product[]>()
  active.forEach((p) => byCat.set(p.categoryId, [...(byCat.get(p.categoryId) ?? []), p]))

  const comandas: ComandaSession[] = []
  const orders:   Order[] = []

  for (let d = days; d >= 1; d--) {
    const day = new Date(today)
    day.setDate(day.getDate() - d)
    const rnd = createRandom(hashString(`${slug}:${day.toDateString()}`))

    const dow   = day.getDay()
    const mult  = dow === 6 ? 1.5 : dow === 0 ? 1.3 : dow === 1 ? 0.8 : 1
    const trend = 1 + (days - d) * 0.004
    const count = Math.round(rnd.int(34, 46) * mult * trend)
    let senha   = 0

    const opens = Array.from({ length: count }, () => {
      const h = rnd.weighted(HOURS)
      return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, rnd.int(0, 59)).getTime()
    }).sort((a, b) => a - b)

    opens.forEach((openedMs, idx) => {
      const id     = `h-${day.getTime()}-${idx}`
      const dest   = randomDestination(rnd, settings.tables)
      const nOrd   = rnd.chance(0.3) ? 2 : 1
      const mine: Order[] = []
      let t = openedMs + rnd.int(1, 4) * 60_000

      for (let k = 0; k < nOrd; k++) {
        const hour  = new Date(t).getHours()
        const lines = rnd.int(1, 3)
        const items = []
        for (let l = 0; l < lines; l++) {
          const cat  = rnd.weighted(categoryWeights(hour))
          const pool = byCat.get(cat)
          if (!pool?.length) continue
          const p   = rnd.weighted(pool.map((x) => [x, x.tags?.includes('Mais pedido') ? 2 : 1] as [Product, number]))
          const qty = p.id === 'frances' ? rnd.int(2, 8) : rnd.chance(0.2) ? 2 : 1
          items.push(buildItem(p, qty, insumos, choicesFor(p, randomChoiceIds(p, rnd)), undefined, `${id}-${k}-${l}`))
        }
        if (!items.length) continue

        const slowest = Math.max(...items.map((i) => {
          const [min, max] = PREP[i.station]
          return rnd.int(min, max) + (i.categoryId === 'pratos' ? 4 : 0)
        }))
        const started   = t + rnd.int(0, 3) * 60_000
        const ready     = started + slowest * 60_000
        const delivered = ready + rnd.int(1, 3) * 60_000

        mine.push({
          id: `${id}-${k}`,
          number: ++senha,
          comandaId: id,
          comandaNumber: String(rnd.int(settings.comandaMin, settings.comandaMax)).padStart(3, '0'),
          destination: dest,
          origin: 'cliente',
          items,
          status: 'delivered',
          createdAt:   new Date(t).toISOString(),
          startedAt:   new Date(started).toISOString(),
          readyAt:     new Date(ready).toISOString(),
          deliveredAt: new Date(delivered).toISOString(),
          deliveredBy: 'salao',
        })
        t = delivered + rnd.int(15, 35) * 60_000
      }
      if (!mine.length) return

      const closedMs = new Date(mine[mine.length - 1].deliveredAt!).getTime() + rnd.int(10, 40) * 60_000
      const subtotal = mine.reduce((s, o) => s + orderSubtotal(o), 0)
      const discount = rnd.chance(0.05) ? Math.round(subtotal * 0.1) : 0
      const fee      = Math.round((subtotal - discount) * settings.serviceFeePercent / 100)
      const method   = rnd.weighted(METHODS)
      mine.forEach((o) => { o.comandaNumber = mine[0].comandaNumber })

      comandas.push({
        id,
        number: mine[0].comandaNumber,
        status: 'closed',
        origin: 'cliente',
        destination: dest,
        openedAt: new Date(openedMs).toISOString(),
        closedAt: new Date(closedMs).toISOString(),
        payment: {
          subtotal, discount, serviceFee: fee, total: subtotal - discount + fee,
          method, paidAt: new Date(closedMs).toISOString(), operator: 'Marta', cashierSessionId: `h-caixa-${day.getTime()}`,
        },
      })
      orders.push(...mine)
    })
  }

  cache = { key, value: { comandas, orders } }
  return cache.value
}
