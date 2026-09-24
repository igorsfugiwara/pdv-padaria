import type { Category, ComandaSession, Order, SimpleMethod } from '@/types'
import { kitchenMinutes } from './timing'
import { orderSubtotal, orderCost } from '@/mock/build'
import { startOfDay } from './format'

export type PeriodKey = 'today' | '7d' | '30d'

export const periodLabels: Record<PeriodKey, string> = {
  today: 'Hoje',
  '7d':  'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
}

export function periodStart(p: PeriodKey): Date {
  const d = startOfDay()
  if (p === '7d')  d.setDate(d.getDate() - 6)
  if (p === '30d') d.setDate(d.getDate() - 29)
  return d
}

export interface SeriesPoint { key: string; label: string; value: number }

export interface Report {
  revenue: number
  count: number
  avgTicket: number
  netSales: number          // subtotal − desconto (base da margem)
  discount: number
  serviceFee: number
  cmv: number               // custo teórico pela ficha técnica
  grossMargin: number       // (vendas líquidas − CMV) / vendas líquidas
  byMethod: { method: SimpleMethod; amount: number }[]
  byCategory: { id: string; name: string; revenue: number; qty: number }[]
  topProducts: { id: string; name: string; emoji: string; qty: number; revenue: number; cost: number }[]
  series: SeriesPoint[]
  kitchen: { count: number; avgMinutes: number; lateShare: number }
}

// Pagamentos dentro do período + pedidos dessas comandas
export function buildReport(
  period: PeriodKey,
  comandas: ComandaSession[],
  orders: Order[],
  categories: Category[],
  lateMinutes: number,
): Report {
  const from   = periodStart(period).getTime()
  const inside = (iso?: string) => !!iso && new Date(iso).getTime() >= from

  const paid     = comandas.filter((c) => c.status === 'closed' && c.payment && inside(c.payment.paidAt))
  const paidIds  = new Set(paid.map((c) => c.id))
  const soldOrders = orders.filter((o) => paidIds.has(o.comandaId))

  const revenue    = paid.reduce((s, c) => s + c.payment!.total, 0)
  const discount   = paid.reduce((s, c) => s + c.payment!.discount, 0)
  const serviceFee = paid.reduce((s, c) => s + c.payment!.serviceFee, 0)
  const subtotal   = paid.reduce((s, c) => s + c.payment!.subtotal, 0)
  const cmv        = soldOrders.reduce((s, o) => s + orderCost(o), 0)
  const netSales   = subtotal - discount

  const methods: Record<SimpleMethod, number> = { pix: 0, dinheiro: 0, debito: 0, credito: 0, voucher: 0 }
  paid.forEach((c) => {
    const p = c.payment!
    if (p.method === 'misto') p.parts?.forEach((x) => { methods[x.method] += x.amount })
    else methods[p.method] += p.total
  })

  const cat = new Map<string, { revenue: number; qty: number }>()
  const prod = new Map<string, { name: string; emoji: string; qty: number; revenue: number; cost: number }>()
  soldOrders.forEach((o) => o.items.forEach((i) => {
    if (i.cancelled) return
    const c = cat.get(i.categoryId) ?? { revenue: 0, qty: 0 }
    c.revenue += i.unitPrice * i.quantity
    c.qty     += i.quantity
    cat.set(i.categoryId, c)
    const p = prod.get(i.productId) ?? { name: i.productName, emoji: i.emoji, qty: 0, revenue: 0, cost: 0 }
    p.qty     += i.quantity
    p.revenue += i.unitPrice * i.quantity
    p.cost    += i.unitCost * i.quantity
    prod.set(i.productId, p)
  }))

  // Série: por hora (hoje, pelo valor pedido — inclui comandas ainda abertas) ou por dia (pelo pago)
  let series: SeriesPoint[] = []
  if (period === 'today') {
    const byHour = new Map<number, number>()
    orders.filter((o) => inside(o.createdAt)).forEach((o) => {
      const h = new Date(o.createdAt).getHours()
      byHour.set(h, (byHour.get(h) ?? 0) + orderSubtotal(o))
    })
    const hours = [...byHour.keys()]
    const first = Math.min(6, ...hours)
    const last  = Math.max(new Date().getHours(), ...hours)
    for (let h = first; h <= last; h++) {
      series.push({ key: String(h), label: `${String(h).padStart(2, '0')}h`, value: byHour.get(h) ?? 0 })
    }
  } else {
    const byDay = new Map<string, number>()
    paid.forEach((c) => {
      const k = startOfDay(new Date(c.payment!.paidAt)).toISOString()
      byDay.set(k, (byDay.get(k) ?? 0) + c.payment!.total)
    })
    const d = periodStart(period)
    const end = startOfDay()
    while (d <= end) {
      const k = d.toISOString()
      series.push({
        key: k,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        value: byDay.get(k) ?? 0,
      })
      d.setDate(d.getDate() + 1)
    }
  }

  // Cozinha: pedidos que ficaram prontos no período
  const cooked  = orders.filter((o) => o.readyAt && inside(o.readyAt))
  const minutes = cooked.map((o) => kitchenMinutes(o, Date.now()))
  const kitchen = {
    count:      cooked.length,
    avgMinutes: minutes.length ? minutes.reduce((a, b) => a + b, 0) / minutes.length : 0,
    lateShare:  minutes.length ? minutes.filter((m) => m >= lateMinutes).length / minutes.length : 0,
  }

  const catName = new Map(categories.map((c) => [c.id, c.name]))

  return {
    revenue,
    count: paid.length,
    avgTicket: paid.length ? Math.round(revenue / paid.length) : 0,
    netSales,
    discount,
    serviceFee,
    cmv,
    grossMargin: netSales > 0 ? (netSales - cmv) / netSales : 0,
    byMethod: (Object.entries(methods) as [SimpleMethod, number][])
      .filter(([, v]) => v > 0)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    byCategory: [...cat.entries()]
      .map(([id, v]) => ({ id, name: catName.get(id) ?? id, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    topProducts: [...prod.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    series,
    kitchen,
  }
}
