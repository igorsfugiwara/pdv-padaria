import type { Category, Insumo, Product, Settings, StaffUser, Tenant } from '@/types'
import * as cortico from './cortico'

// Registro de estabelecimentos. Cada loja tem marca, cardápio, insumos e equipe
// próprios; os dados ficam separados no armazenamento por `slug`.
export interface TenantBundle {
  tenant:     Tenant
  staff:      StaffUser[]
  settings:   Settings
  categories: Category[]
  seedProducts: () => Product[]
  seedInsumos:  () => Insumo[]
}

export const tenants: Record<string, TenantBundle> = {
  cortico: {
    tenant:       cortico.tenant,
    staff:        cortico.staff,
    settings:     cortico.settings,
    categories:   cortico.catalog.categories,
    seedProducts: cortico.catalog.seedProducts,
    seedInsumos:  cortico.catalog.seedInsumos,
  },
}

// A loja é definida pelo primeiro segmento da URL na carga da página.
// Trocar de loja recarrega o app (ver router), então as stores nascem já com ela.
export function bootTenantSlug(): string | null {
  const slug = window.location.pathname.split('/')[1] ?? ''
  return tenants[slug] ? slug : null
}

let current: TenantBundle | null = null

export function useTenantBundle(): TenantBundle {
  if (!current) {
    const slug = bootTenantSlug()
    if (!slug) throw new Error('Nenhuma loja selecionada')
    current = tenants[slug]
  }
  return current
}
