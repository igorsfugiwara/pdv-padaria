import type { Order, OrderItem, Product, SelectedChoice } from '@/types'
import { unitCost, unitPrice, defaultChoices, type InsumoIndex } from '@/lib/recipe'
import { newId } from '@/lib/ids'

// Monta itens de pedido já com preço e custo congelados, como o app faz ao vender

export function choicesFor(product: Product, choiceIds: string[] = []): SelectedChoice[] {
  const picked: SelectedChoice[] = []
  for (const g of product.options ?? []) {
    const chosen = g.choices.filter((c) => choiceIds.includes(c.id))
    chosen.slice(0, g.max).forEach((c) =>
      picked.push({ groupId: g.id, groupName: g.name, choiceId: c.id, name: c.name, price: c.price })
    )
  }
  // grupos obrigatórios sem escolha explícita ficam no padrão
  for (const d of defaultChoices(product)) {
    if (!picked.some((p) => p.groupId === d.groupId)) picked.push(d)
  }
  return picked
}

export function buildItem(
  product: Product,
  quantity: number,
  insumos: InsumoIndex,
  choices: SelectedChoice[] = choicesFor(product),
  note?: string,
  id: string = newId(),
): OrderItem {
  return {
    id,
    productId:   product.id,
    productName: product.name,
    categoryId:  product.categoryId,
    emoji:       product.emoji,
    station:     product.station,
    unitPrice:   unitPrice(product, choices),
    unitCost:    unitCost(product, choices, insumos),
    quantity,
    choices,
    note,
  }
}

export function orderSubtotal(o: Order): number {
  return o.items.reduce((s, i) => s + (i.cancelled ? 0 : i.unitPrice * i.quantity), 0)
}

export function orderCost(o: Order): number {
  return o.items.reduce((s, i) => s + (i.cancelled ? 0 : i.unitCost * i.quantity), 0)
}
