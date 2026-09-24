import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CartItem, OrderItem, Product, SelectedChoice } from '@/types'
import { load, save } from '@/lib/storage'
import { tenantPrefix } from '@/db/persisted'
import { newId } from '@/lib/ids'
import { unitPrice } from '@/lib/recipe'
import { buildItem } from '@/mock/build'
import { useCustomerStore } from './useCustomerStore'
import { useCatalogStore } from './useCatalogStore'

export interface CartLine extends CartItem {
  product: Product
  unitPrice: number
  orderable: boolean
}

// Sacola local, por comanda. Guarda só a escolha; preço e disponibilidade vêm
// sempre do cardápio atual (se a loja mudar o preço, a sacola acompanha).
export const useCartStore = defineStore('cart', () => {
  const customer = useCustomerStore()
  const catalog  = useCatalogStore()
  const items    = ref<CartItem[]>([])

  const storageKey = computed(() => `${tenantPrefix()}cart:${customer.sessionId ?? '-'}`)
  watch(storageKey, (key) => { items.value = load<CartItem[]>(key, []) }, { immediate: true })
  watch(items, (val) => save(storageKey.value, val), { deep: true })

  const lines = computed<CartLine[]>(() =>
    items.value.flatMap((i) => {
      const product = catalog.productById.get(i.productId)
      if (!product) return []
      return [{ ...i, product, unitPrice: unitPrice(product, i.choices), orderable: catalog.isOrderable(product) }]
    })
  )

  const count = computed(() => lines.value.reduce((s, l) => s + l.quantity, 0))
  const total = computed(() => lines.value.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const hasUnavailable = computed(() => lines.value.some((l) => !l.orderable))

  function sameConfig(a: CartItem, productId: string, choices: SelectedChoice[], note?: string): boolean {
    if (a.productId !== productId || (a.note ?? '') !== (note ?? '')) return false
    const ids = (cs: SelectedChoice[]) => cs.map((c) => `${c.groupId}:${c.choiceId}`).sort().join('|')
    return ids(a.choices) === ids(choices)
  }

  function add(product: Product, quantity: number, choices: SelectedChoice[] = [], note?: string): void {
    const cleanNote = note?.trim() || undefined
    const existing  = items.value.find((i) => sameConfig(i, product.id, choices, cleanNote))
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, 99)
    else items.value.push({ id: newId(), productId: product.id, quantity, choices, note: cleanNote })
  }

  function setQty(id: string, quantity: number): void {
    if (quantity <= 0) { removeItem(id); return }
    const item = items.value.find((i) => i.id === id)
    if (item) item.quantity = Math.min(quantity, 99)
  }

  function removeItem(id: string): void {
    items.value = items.value.filter((i) => i.id !== id)
  }

  function clear(): void {
    items.value = []
  }

  // Itens prontos para virar pedido, com preço e custo congelados agora
  function toOrderItems(): Omit<OrderItem, 'id'>[] {
    return lines.value
      .filter((l) => l.orderable)
      .map((l) => {
        const { id: _drop, ...item } = buildItem(l.product, l.quantity, catalog.insumoIndex, l.choices, l.note)
        return item
      })
  }

  return { items, lines, count, total, hasUnavailable, add, setQty, removeItem, clear, toOrderItems }
})
