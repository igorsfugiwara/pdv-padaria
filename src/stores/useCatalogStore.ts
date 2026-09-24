import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { orderBy, limit } from 'firebase/firestore'
import type { Insumo, OrderItem, Product, StockMove } from '@/types'
import { useCollection } from '@/db/collection'
import { isStaffScope } from '@/db/context'
import { localSeed } from '@/db/seed'
import { useTenantBundle } from '@/mock/tenants'
import { indexInsumos, fullRecipe, unitCost, defaultChoices } from '@/lib/recipe'
import { newId } from '@/lib/ids'

// Cardápio + ficha técnica + insumos. Os insumos baixam quando a cozinha começa
// o preparo (ou na venda direta do caixa). O cliente não lê o estoque: para ele,
// o "esgotado por falta de insumo" vem do campo `stockOut`, mantido pela equipe.
export const useCatalogStore = defineStore('catalog', () => {
  const bundle = useTenantBundle()
  const categories = computed(() => bundle.categories)

  const productsColl = useCollection<Product>('products', {
    local: () => localSeed().collections.products,
    sources: () => [{ kind: 'query', key: 'all', constraints: [] }],
  })
  const insumosColl = useCollection<Insumo>('insumos', {
    local: () => localSeed().collections.insumos,
    sources: () => (isStaffScope() ? [{ kind: 'query', key: 'all', constraints: [] }] : []),
  })
  const movesColl = useCollection<StockMove>('stockMoves', {
    local: () => localSeed().collections.stockMoves,
    sources: () => (isStaffScope() ? [{ kind: 'query', key: 'recent', constraints: [orderBy('createdAt', 'desc'), limit(300)] }] : []),
  })

  const products   = productsColl.items
  const insumos    = insumosColl.items
  const stockMoves = computed(() => [...movesColl.items.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

  const insumoIndex    = computed(() => indexInsumos(insumos.value))
  const productById    = computed(() => new Map(products.value.map((p) => [p.id, p])))
  const activeProducts = computed(() => products.value.filter((p) => p.active))
  const stockVisible   = computed(() => isStaffScope() && insumos.value.length > 0)

  // Insumo da receita base sem saldo para uma unidade → produto esgotado
  function missingInsumo(p: Product): Insumo | null {
    for (const line of fullRecipe(p, defaultChoices(p))) {
      const i = insumoIndex.value.get(line.insumoId)
      if (i && i.stock < line.qty) return i
    }
    return null
  }

  function isOrderable(p: Product): boolean {
    if (!p.active || !p.available) return false
    return stockVisible.value ? !missingInsumo(p) : !p.stockOut
  }

  function baseCost(p: Product): number {
    return unitCost(p, defaultChoices(p), insumoIndex.value)
  }

  const lowStock = computed(() => insumos.value.filter((i) => i.stock <= i.minStock))

  // A equipe mantém o `stockOut` dos produtos em dia para o app do cliente
  let flagTimer: ReturnType<typeof setTimeout> | null = null
  function syncStockFlags() {
    if (!stockVisible.value) return
    let changed = false
    for (const p of products.value) {
      const out = !!missingInsumo(p)
      if (!!p.stockOut !== out) { p.stockOut = out; changed = true }
    }
    if (changed) productsColl.commit()
  }
  watch(insumoIndex, () => {
    if (flagTimer) clearTimeout(flagTimer)
    flagTimer = setTimeout(syncStockFlags, 400)
  })

  // --- Produtos ---
  async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
    const p = products.value.find((x) => x.id === id)
    if (!p) return
    Object.assign(p, patch)
    await productsColl.commit()
  }

  async function addProduct(data: Omit<Product, 'id'>): Promise<Product> {
    const p = { ...data, id: newId() }
    await productsColl.add(p)
    return p
  }

  async function toggleAvailable(id: string): Promise<void> {
    const p = productById.value.get(id)
    if (p) await updateProduct(id, { available: !p.available })
  }

  // --- Estoque ---
  async function consume(items: OrderItem[]): Promise<void> {
    const deltas = new Map<string, number>()
    for (const item of items) {
      if (item.cancelled) continue
      const p = productById.value.get(item.productId)
      if (!p) continue
      for (const line of fullRecipe(p, item.choices)) {
        deltas.set(line.insumoId, (deltas.get(line.insumoId) ?? 0) + line.qty * item.quantity)
      }
    }
    await Promise.all([...deltas].map(([id, qty]) => insumosColl.increment(id, 'stock', -qty)))
  }

  async function addMove(move: Omit<StockMove, 'id' | 'insumoName' | 'createdAt'>): Promise<void> {
    const ins = insumos.value.find((x) => x.id === move.insumoId)
    if (!ins) return
    // Compra e produção com custo recalculam o custo médio ponderado
    if (move.qty > 0 && move.unitCost !== undefined && ins.stock + move.qty > 0) {
      const before = Math.max(ins.stock, 0)
      ins.avgCost  = Math.round((before * ins.avgCost + move.qty * move.unitCost) / (before + move.qty))
      await insumosColl.commit()
    }
    await insumosColl.increment(ins.id, 'stock', move.qty)
    await movesColl.add({ ...move, id: newId(), insumoName: ins.name, createdAt: new Date().toISOString() })
  }

  async function updateInsumo(id: string, patch: Partial<Insumo>): Promise<void> {
    const i = insumos.value.find((x) => x.id === id)
    if (!i) return
    Object.assign(i, patch)
    await insumosColl.commit()
  }

  async function addInsumo(data: Omit<Insumo, 'id'>): Promise<Insumo> {
    const ins = { ...data, id: newId() }
    await insumosColl.add(ins)
    return ins
  }

  function productsUsing(insumoId: string): Product[] {
    return products.value.filter((p) =>
      p.recipe.some((l) => l.insumoId === insumoId) ||
      p.options?.some((g) => g.choices.some((c) => c.recipe?.some((l) => l.insumoId === insumoId)))
    )
  }

  return {
    categories, products, insumos, stockMoves, insumoIndex, productById, activeProducts, lowStock,
    missingInsumo, isOrderable, baseCost,
    updateProduct, addProduct, toggleAvailable,
    consume, addMove, updateInsumo, addInsumo, productsUsing,
    ready: productsColl.ready,
  }
})
