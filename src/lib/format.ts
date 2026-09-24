import type { Destination, PaymentMethod, Role, Station, Unit } from '@/types'

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '−' : ''
  const abs  = Math.abs(cents) / 100
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Valores grandes em tiles: R$ 12,9 mil
export function formatMoneyCompact(cents: number): string {
  const v = cents / 100
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (Math.abs(v) >= 10_000)    return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return formatMoney(cents)
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
}

export function minutesBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60_000)
}

export function formatDuration(mins: number): string {
  const m = Math.round(mins)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export function formatOrderNumber(n: number): string {
  return '#' + String(n).padStart(3, '0')
}

// Quantidade de insumo legível: 0,18 kg → 180 g, 0,2 l → 200 ml
export function formatQty(qty: number, unit: Unit): string {
  const abs = Math.abs(qty)
  const fmt = (v: number, d: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: d })
  if (unit === 'kg' && abs > 0 && abs < 1) return `${fmt(qty * 1000, 0)} g`
  if (unit === 'l'  && abs > 0 && abs < 1) return `${fmt(qty * 1000, 0)} ml`
  if (unit === 'un') return `${fmt(qty, 1)} un`
  return `${fmt(qty, 2)} ${unit}`
}

export const unitLabels: Record<Unit, string> = { kg: 'kg', l: 'litro', un: 'unidade' }

export const stationLabels: Record<Station, string> = {
  cozinha: 'Cozinha',
  cafe:    'Café',
  balcao:  'Balcão',
}

export const roleLabels: Record<Role, string> = {
  cozinha: 'Cozinha',
  salao:   'Salão',
  caixa:   'Caixa',
  gerente: 'Gerência',
}

export const methodLabels: Record<PaymentMethod, string> = {
  pix:      'PIX',
  dinheiro: 'Dinheiro',
  debito:   'Débito',
  credito:  'Crédito',
  voucher:  'Vale-refeição',
  misto:    'Misto',
}

export function destinationLabel(d?: Destination): string {
  if (!d) return 'Sem local'
  if (d.type === 'mesa') return `Mesa ${d.table}`
  return d.type === 'balcao' ? 'Balcão' : 'Para viagem'
}

export function comandaLabel(number: string): string {
  return number.startsWith('V') ? `Venda ${number}` : `Comanda ${number}`
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function isToday(iso: string): boolean {
  return new Date(iso) >= startOfDay()
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
