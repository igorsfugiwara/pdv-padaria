import { defineStore } from 'pinia'
import { computed } from 'vue'
import { orderBy, limit, where } from 'firebase/firestore'
import type { CashierSession, CashMovement, ComandaSession, SimpleMethod } from '@/types'
import { useCollection } from '@/db/collection'
import { isStaffScope } from '@/db/context'
import { localSeed } from '@/db/seed'
import { startOfDay } from '@/lib/format'
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
  const sessionsColl = useCollection<CashierSession>('cashierSessions', {
    local: () => localSeed().collections.cashierSessions,
    sources: () => (isStaffScope() ? [{ kind: 'query', key: 'recent', constraints: [orderBy('openedAt', 'desc'), limit(30)] }] : []),
  })
  const movementsColl = useCollection<CashMovement>('cashMovements', {
    local: () => localSeed().collections.cashMovements,
    sources: () => {
      if (!isStaffScope()) return []
      const since = new Date(startOfDay().getTime() - 35 * 86_400_000).toISOString()
      return [{ kind: 'query', key: `since-${since}`, constraints: [where('createdAt', '>=', since)] }]
    },
  })
  const sessions  = sessionsColl.items
  const movements = computed(() => [...movementsColl.items.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

  const active  = computed(() => sessions.value.find((s) => !s.closedAt) ?? null)
  const history = computed(() =>
    sessions.value.filter((s) => s.closedAt).sort((a, b) => b.openedAt.localeCompare(a.openedAt))
  )

  async function open(operator: string, openingBalance: number): Promise<void> {
    if (active.value) return
    await sessionsColl.add({ id: newId(), operator, openingBalance, openedAt: new Date().toISOString() })
  }

  async function close(countedCash: number, notes?: string): Promise<void> {
    const s = active.value
    if (!s) return
    s.closedAt    = new Date().toISOString()
    s.countedCash = countedCash
    s.notes       = notes?.trim() || undefined
    await sessionsColl.commit()
  }

  async function addMovement(type: CashMovement['type'], amount: number, reason: string, operator: string): Promise<void> {
    if (!active.value) return
    await movementsColl.add({
      id: newId(), sessionId: active.value.id, type, amount, reason: reason.trim(), operator, createdAt: new Date().toISOString(),
    })
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
