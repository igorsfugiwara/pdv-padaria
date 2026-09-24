import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { CashierSession, CashMovement, ComandaSession, SimpleMethod } from '@/types'
import { persisted } from '@/db/persisted'
import { liveSeed } from '@/db/seed'
import { newId } from '@/lib/ids'
import { useComandasStore } from './useComandasStore'

export interface CashierSummary {
  count: number
  total: number
  byMethod: Record<SimpleMethod, number>
  cashSales: number
  suprimentos: number
  sangrias: number
  expectedCash: number
}

export const useCashierStore = defineStore('cashier', () => {
  const { data: sessions,  commit: commitSessions }  = persisted<CashierSession[]>('cashier-sessions', () => liveSeed().cashierSessions)
  const { data: movements, commit: commitMovements } = persisted<CashMovement[]>('cash-movements', () => liveSeed().movements)

  const active = computed(() => sessions.value.find((s) => !s.closedAt) ?? null)
  const history = computed(() =>
    sessions.value.filter((s) => s.closedAt).sort((a, b) => b.openedAt.localeCompare(a.openedAt))
  )

  function open(operator: string, openingBalance: number): void {
    if (active.value) return
    sessions.value.push({ id: newId(), operator, openingBalance, openedAt: new Date().toISOString() })
    commitSessions()
  }

  function close(countedCash: number, notes?: string): void {
    const s = active.value
    if (!s) return
    s.closedAt    = new Date().toISOString()
    s.countedCash = countedCash
    s.notes       = notes?.trim() || undefined
    commitSessions()
  }

  function addMovement(type: CashMovement['type'], amount: number, reason: string, operator: string): void {
    if (!active.value) return
    movements.value.unshift({
      id: newId(), sessionId: active.value.id, type, amount, reason: reason.trim(), operator, createdAt: new Date().toISOString(),
    })
    commitMovements()
  }

  function paidComandas(sessionId: string): ComandaSession[] {
    return useComandasStore().sessions.filter((c) => c.payment?.cashierSessionId === sessionId)
  }

  function summary(sessionId: string): CashierSummary {
    const session = sessions.value.find((s) => s.id === sessionId)
    const paid    = paidComandas(sessionId)
    const byMethod: Record<SimpleMethod, number> = { pix: 0, dinheiro: 0, debito: 0, credito: 0, voucher: 0 }
    for (const c of paid) {
      const p = c.payment!
      if (p.method === 'misto') p.parts?.forEach((part) => { byMethod[part.method] += part.amount })
      else byMethod[p.method] += p.total
    }
    const moves       = movements.value.filter((m) => m.sessionId === sessionId)
    const suprimentos = moves.filter((m) => m.type === 'suprimento').reduce((s, m) => s + m.amount, 0)
    const sangrias    = moves.filter((m) => m.type === 'sangria').reduce((s, m) => s + m.amount, 0)
    return {
      count: paid.length,
      total: paid.reduce((s, c) => s + c.payment!.total, 0),
      byMethod,
      cashSales: byMethod.dinheiro,
      suprimentos,
      sangrias,
      expectedCash: (session?.openingBalance ?? 0) + byMethod.dinheiro + suprimentos - sangrias,
    }
  }

  return { sessions, movements, active, history, open, close, addMovement, paidComandas, summary }
})
