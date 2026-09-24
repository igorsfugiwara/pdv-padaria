import { defineStore } from 'pinia'
import { computed } from 'vue'
import { doc, where, runTransaction, arrayUnion } from 'firebase/firestore'
import type { ComandaSession, Destination, Order, OrderItem, OrderStatus, Role } from '@/types'
import { firebaseEnabled, firestore } from '@/firebase'
import { useCollection } from '@/db/collection'
import { dbContext, isStaffScope } from '@/db/context'
import { localSeed } from '@/db/seed'
import { tenantPath } from '@/db/tenant'
import { dayKey } from '@/db/seed-data'
import { isToday, startOfDay } from '@/lib/format'
import { newId } from '@/lib/ids'
import { orderSubtotal } from '@/mock/build'
import { useCatalogStore } from './useCatalogStore'
import { useComandasStore } from './useComandasStore'

export const statusFlow: OrderStatus[] = ['received', 'preparing', 'ready', 'delivered']

export const statusLabels: Record<OrderStatus, string> = {
  received:  'Recebido',
  preparing: 'Em preparo',
  ready:     'Pronto',
  delivered: 'Entregue',
}

// Fila de pedidos. Cozinha avança o preparo; cozinha OU salão dão baixa na entrega.
// A equipe assina os pedidos das últimas horas; o cliente, só os da comanda dele.
export const useOrderStore = defineStore('orders', () => {
  const coll = useCollection<Order>('orders', {
    local: () => localSeed().collections.orders,
    sources: () => {
      if (isStaffScope()) {
        const since = new Date(startOfDay().getTime() - 12 * 3_600_000).toISOString()
        return [{ kind: 'query', key: `since-${since}`, constraints: [where('createdAt', '>=', since)] }]
      }
      return dbContext.customerOrderIds.map((id) => ({ kind: 'doc' as const, id }))
    },
  })
  const orders = coll.items

  const active = computed(() => orders.value.filter((o) => o.status !== 'delivered'))
  const today  = computed(() => orders.value.filter((o) => isToday(o.createdAt)))

  function byComanda(comandaId: string): Order[] {
    return orders.value
      .filter((o) => o.comandaId === comandaId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  function comandaSubtotal(comandaId: string): number {
    return byComanda(comandaId).reduce((s, o) => s + orderSubtotal(o), 0)
  }

  function pendingInComanda(comandaId: string): Order[] {
    return byComanda(comandaId).filter((o) => o.status !== 'delivered')
  }

  async function place(
    session: ComandaSession,
    items: Omit<OrderItem, 'id'>[],
    destination: Destination,
    opts: { note?: string; origin?: Order['origin']; skipKitchen?: boolean } = {},
  ): Promise<Order> {
    const now   = new Date().toISOString()
    const order: Order = {
      id: newId(),
      number: 0,
      comandaId:     session.id,
      comandaNumber: session.number,
      customerName:  session.customerName,
      destination,
      origin: opts.origin ?? 'cliente',
      note:   opts.note?.trim() || undefined,
      items:  items.map((i) => ({ ...i, id: newId() })),
      // Venda de balcão entregue na hora não passa pela cozinha
      status:      opts.skipKitchen ? 'delivered' : 'received',
      createdAt:   now,
      deliveredAt: opts.skipKitchen ? now : undefined,
      deliveredBy: opts.skipKitchen ? 'caixa' : undefined,
      consumedAt:  opts.skipKitchen ? now : undefined,
    }

    if (firebaseEnabled) {
      // Senha do dia + pedido + vínculo na comanda, tudo ou nada
      const counterRef = doc(firestore!, `${tenantPath()}/counters/orders`)
      const comandaRef = useComandasStore().docRef(session.id)
      await runTransaction(firestore!, async (tx) => {
        const c     = await tx.get(counterRef)
        const today = dayKey()
        order.number = (c.exists() && c.data().day === today ? c.data().seq : 0) + 1
        tx.set(counterRef, { day: today, seq: order.number })
        const { id, ...data } = order
        tx.set(coll.docRef(id), JSON.parse(JSON.stringify(data)))
        tx.update(comandaRef, { orderIds: arrayUnion(id) })
      })
      coll.addLocal(order)
    } else {
      await new Promise((r) => setTimeout(r, opts.origin === 'caixa' ? 150 : 600))
      order.number = today.value.reduce((m, o) => Math.max(m, o.number), 0) + 1
      await coll.add(order)
      const comandas = useComandasStore()
      const s = comandas.byId.get(session.id)
      if (s) { s.orderIds = [...(s.orderIds ?? []), order.id]; await comandas.commit() }
    }

    if (opts.skipKitchen) await useCatalogStore().consume(order.items)
    return order
  }

  async function set(id: string, patch: Partial<Order>): Promise<void> {
    const o = orders.value.find((x) => x.id === id)
    if (!o) return
    Object.assign(o, patch)
    await coll.commit()
  }

  async function advance(id: string, by: Role): Promise<void> {
    const o = orders.value.find((x) => x.id === id)
    if (!o) return
    const now = new Date().toISOString()
    if (o.status === 'received') {
      // A ficha técnica baixa os insumos quando a cozinha começa o preparo
      if (!o.consumedAt) await useCatalogStore().consume(o.items)
      await set(id, { status: 'preparing', startedAt: now, consumedAt: o.consumedAt ?? now })
    } else if (o.status === 'preparing') {
      await set(id, { status: 'ready', readyAt: now })
    } else if (o.status === 'ready') {
      await set(id, { status: 'delivered', deliveredAt: now, deliveredBy: by })
    }
  }

  async function revert(id: string): Promise<void> {
    const o = orders.value.find((x) => x.id === id)
    if (!o) return
    if (o.status === 'preparing') await set(id, { status: 'received', startedAt: undefined })
    if (o.status === 'ready')     await set(id, { status: 'preparing', readyAt: undefined })
    if (o.status === 'delivered') await set(id, { status: 'ready', deliveredAt: undefined, deliveredBy: undefined })
  }

  async function cancelItem(orderId: string, itemId: string, by: string, reason: string): Promise<void> {
    const o = orders.value.find((x) => x.id === orderId)
    const item = o?.items.find((i) => i.id === itemId)
    if (!o || !item) return
    item.cancelled = { at: new Date().toISOString(), by, reason }
    // pedido sem nenhum item válido sai da fila
    if (o.items.every((i) => i.cancelled) && o.status !== 'delivered') {
      o.status = 'delivered'
      o.deliveredAt = item.cancelled.at
      o.deliveredBy = 'caixa'
    }
    await coll.commit()
  }

  return { orders, active, today, byComanda, comandaSubtotal, pendingInComanda, place, advance, revert, cancelItem, ready: coll.ready }
})
