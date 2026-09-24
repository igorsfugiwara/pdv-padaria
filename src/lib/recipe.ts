import type { Insumo, Product, RecipeLine, SelectedChoice } from '@/types'

export type InsumoIndex = Map<string, Insumo>

export function indexInsumos(list: Insumo[]): InsumoIndex {
  return new Map(list.map((i) => [i.id, i]))
}

export function recipeCost(lines: RecipeLine[], insumos: InsumoIndex): number {
  return Math.round(lines.reduce((s, l) => s + (insumos.get(l.insumoId)?.avgCost ?? 0) * l.qty, 0))
}

// Receita completa de 1 unidade vendida: base do produto + o que cada adicional consome
export function fullRecipe(product: Product, choices: SelectedChoice[]): RecipeLine[] {
  const extra = choices.flatMap((c) => {
    const group  = product.options?.find((g) => g.id === c.groupId)
    const choice = group?.choices.find((x) => x.id === c.choiceId)
    return choice?.recipe ?? []
  })
  return [...product.recipe, ...extra]
}

export function unitCost(product: Product, choices: SelectedChoice[], insumos: InsumoIndex): number {
  return recipeCost(fullRecipe(product, choices), insumos)
}

export function unitPrice(product: Product, choices: SelectedChoice[]): number {
  return product.price + choices.reduce((s, c) => s + c.price, 0)
}

// Margem sobre o preço: (preço - custo) / preço
export function margin(price: number, cost: number): number {
  return price > 0 ? (price - cost) / price : 0
}

// Primeira opção de cada grupo obrigatório de escolha única: a configuração "padrão"
export function defaultChoices(product: Product): SelectedChoice[] {
  return (product.options ?? [])
    .filter((g) => g.required && g.max === 1)
    .map((g) => ({ groupId: g.id, groupName: g.name, choiceId: g.choices[0].id, name: g.choices[0].name, price: g.choices[0].price }))
}
