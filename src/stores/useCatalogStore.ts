import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { Insumo, OrderItem, Product, StockMove } from '@/types'
import { persisted } from '@/db/persisted'
import { liveSeed } from '@/db/seed'
import { useTenantBundle } from '@/mock/tenants'
import { indexInsumos, fullRecipe, unitCost, defaultChoices } from '@/lib/recipe'
import { newId } from '@/lib/ids'

// Cardápio + ficha técnica + insumos. Vender baixa os insumos da receita
// (incluindo os adicionais escolhidos) e um insumo zerado esgota o produto.
export const useCatalogStore = defineStore('catalog', () => {
  const bundle = useTenantBundle()
  const categories = computed(() => bundle.categories)

  const { data: products,   commit: commitProducts } = persisted<Product[]>('products', () => bundle.seedProducts())
  const { data: insumos,    commit: commitInsumos }  = persisted<Insumo[]>('insumos', () => bundle.seedInsumos())
  const { data: stockMoves, commit: commitMoves }    = persisted<StockMove[]>('stock-moves', () => liveSeed().stockMoves)

  const insumoIndex = computed(() => indexInsumos(insumos.value))
  const productById = computed(() => new Map(products.value.map((p) => [p.id, p])))

  const activeProducts = computed(() => products.value.filter((p) => p.active))

  // Insumo da receita base sem saldo para uma unidade → produto esgotado automaticamente
  function missingInsumo(p: Product): Insumo | null {
    for (const line of p.recipe) {
      const i = insumoIndex.value.get(line.insumoId)
      if (i && i.stock < line.qty) return i
    }
    return null
  }

  function isOrderable(p: Product): boolean {
    return p.active && p.available && !missingInsumo(p)
  }

  // Custo da configuração padrão (para listagens e margem)
  function baseCost(p: Product): number {
    return unitCost(p, defaultChoices(p), insumoIndex.value)
  }

  const lowStock = computed(() => insumos.value.filter((i) => i.stock <= i.minStock))

  // --- Produtos ---
  function updateProduct(id: string, patch: Partial<Product>): void {
    const i = products.value.findIndex((p) => p.id === id)
    if (i >= 0) {
      products.value[i] = { ...products.value[i], ...patch }
      commitProducts()
    }
  }

  function addProduct(data: Omit<Product, 'id'>): Product {
    const p = { ...data, id: newId() }
    products.value.push(p)
    commitProducts()
    return p
  }

  function toggleAvailable(id: string): void {
    const p = productById.value.get(id)
    if (p) updateProduct(id, { available: !p.available })
  }

  // --- Estoque ---
  function consume(items: OrderItem[]): void {
    for (const item of items) {
      const p = productById.value.get(item.productId)
      if (!p) continue
      for (const line of fullRecipe(p, item.choices)) {
        const ins = insumos.value.find((x) => x.id === line.insumoId)
        if (ins) ins.stock = Math.round((ins.stock - line.qty * item.quantity) * 1000) / 1000
      }
    }
    commitInsumos()
  }

  function addMove(move: Omit<StockMove, 'id' | 'insumoName' | 'createdAt'>): void {
    const ins = insumos.value.find((x) => x.id === move.insumoId)
    if (!ins) return
    // Compra e produção com custo recalculam o custo médio ponderado
    if (move.qty > 0 && move.unitCost !== undefined && ins.stock + move.qty > 0) {
      const before = Math.max(ins.stock, 0)
      ins.avgCost  = Math.round((before * ins.avgCost + move.qty * move.unitCost) / (before + move.qty))
    }
    ins.stock = Math.round((ins.stock + move.qty) * 1000) / 1000
    stockMoves.value.unshift({ ...move, id: newId(), insumoName: ins.name, createdAt: new Date().toISOString() })
    commitInsumos()
    commitMoves()
  }

  function updateInsumo(id: string, patch: Partial<Insumo>): void {
    const i = insumos.value.findIndex((x) => x.id === id)
    if (i >= 0) {
      insumos.value[i] = { ...insumos.value[i], ...patch }
      commitInsumos()
    }
  }

  function addInsumo(data: Omit<Insumo, 'id'>): Insumo {
    const ins = { ...data, id: newId() }
    insumos.value.push(ins)
    commitInsumos()
    return ins
  }

  // Produtos que usam o insumo (base ou adicional)
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
  }
})
