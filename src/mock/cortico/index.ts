import type { Settings, StaffUser, Tenant } from '@/types'
import { categories, seedProducts } from './menu'
import { seedInsumos } from './insumos'

export const tenant: Tenant = {
  slug:      'cortico',
  name:      'Cortiço',
  tagline:   'Padaria · Café · Cozinha',
  logoEmoji: '🥖',
  city:      'São Paulo, SP',
  cnpj:      '12.345.678/0001-90',
}

export const staff: StaffUser[] = [
  { id: 'u-rita',   name: 'Rita',   role: 'cozinha', pin: '1111' },
  { id: 'u-tiago',  name: 'Tiago',  role: 'salao',   pin: '2222' },
  { id: 'u-marta',  name: 'Marta',  role: 'caixa',   pin: '3333' },
  { id: 'u-gestao', name: 'Gestão', role: 'gerente', pin: '0000' },
]

export const settings: Settings = {
  staffTheme:        'escuro',
  warnMinutes:       8,
  lateMinutes:       15,
  serviceFeePercent: 0,
  tables:            16,
  comandaMin:        1,
  comandaMax:        300,
  blockedComandas:   ['013'],
  nfceSeries:        1,
}

export const catalog = { categories, seedProducts, seedInsumos }
