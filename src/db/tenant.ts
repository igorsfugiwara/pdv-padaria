import { bootTenantSlug } from '@/mock/tenants'

const VERSION = 'v2'

export function tenantSlug(): string {
  const slug = bootTenantSlug()
  if (!slug) throw new Error('Nenhuma loja selecionada')
  return slug
}

// Prefixo do armazenamento local (modo mock e preferências do aparelho)
export function tenantPrefix(): string {
  return `pdv:${VERSION}:${bootTenantSlug()}:`
}

// Caminho da loja no Firestore
export function tenantPath(): string {
  return `tenants/${tenantSlug()}`
}
