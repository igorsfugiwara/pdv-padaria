import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { ComandaSession, Destination, Order, OrderItem, OrderStatus, Role } from '@/types'
import { persisted } from '@/db/persisted'
import { liveSeed } from '@/db/seed'
import { isToday } from '@/lib/format'
import { newId } from '@/lib/ids'
import { orderSubtotal } from '@/mock/build'
import { useCatalogStore } from './useCatalogStore'

export const statusFlow: OrderStatus[] = ['received', 'preparing', 'ready', 'delivered']

export const statusLabels: Record<OrderStatus, string> = {
  received:  'Recebido',
  preparing: 'Em preparo',
  ready:     'Pronto',
  delivered: 'Entregue',
}

// Fila de pedidos. Cozinha avança o preparo; cozinha OU salão dão baixa na entrega.
export const useOrderStore = defineStore('orders', () => {
  const { data: orders, commit } = persisted<Order[]>('orders', () => liveSeed().orders)

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
    // Latência simulada para o layout do "enviando" aparecer
    await new Promise((r) => setTimeout(r, opts.origin === 'caixa' ? 150 : 600))
    const now    = new Date().toISOString()
    const number = today.value.reduce((m, o) => Math.max(m, o.number), 0) + 1
    const order: Order = {
      id: newId(),
      number,
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
    }
    orders.value.push(order)
    commit()
    useCatalogStore().consume(order.items)
    return order
  }

  function set(id: string, patch: Partial<Order>): void {
    const i = orders.value.findIndex((o) => o.id === id)
    if (i >= 0) {
      orders.value[i] = { ...orders.value[i], ...patch }
      commit()
    }
  }

  function advance(id: string, by: Role): void {
    const o = orders.value.find((x) => x.id === id)
    if (!o) return
    const now = new Date().toISOString()
    if (o.status === 'received')  set(id, { status: 'preparing', startedAt: now })
    if (o.status === 'preparing') set(id, { status: 'ready', readyAt: now })
    if (o.status === 'ready')     set(id, { status: 'delivered', deliveredAt: now, deliveredBy: by })
  }

  function revert(id: string): void {
    const o = orders.value.find((x) => x.id === id)
    if (!o) return
    if (o.status === 'preparing') set(id, { status: 'received', startedAt: undefined })
    if (o.status === 'ready')     set(id, { status: 'preparing', readyAt: undefined })
    if (o.status === 'delivered') set(id, { status: 'ready', deliveredAt: undefined, deliveredBy: undefined })
  }

  function cancelItem(orderId: string, itemId: string, by: string, reason: string): void {
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
    commit()
  }

  return { orders, active, today, byComanda, comandaSubtotal, pendingInComanda, place, advance, revert, cancelItem }
})
