import { defineStore } from 'pinia'
import { computed } from 'vue'
import { doc, where, runTransaction, getDoc, writeBatch } from 'firebase/firestore'
import type { ComandaSession, Destination, Payment } from '@/types'
import { firebaseEnabled, firestore } from '@/firebase'
import { useCollection } from '@/db/collection'
import { dbContext, isStaffScope } from '@/db/context'
import { localSeed } from '@/db/seed'
import { tenantPath } from '@/db/tenant'
import { nextSequence } from '@/db/counters'
import { isToday, startOfDay } from '@/lib/format'
import { newId } from '@/lib/ids'

// Sessões de comanda. O cartão físico é reutilizado: cada vez que volta a
// circular depois de pago, nasce uma sessão nova com o mesmo número.
// No Firestore, openComandas/{número} aponta para a sessão aberta daquele cartão.
export const useComandasStore = defineStore('comandas', () => {
  const coll = useCollection<ComandaSession>('comandas', {
    local: () => localSeed().collections.comandas,
    sources: () => {
      if (isStaffScope()) {
        const today = startOfDay().toISOString()
        return [
          { kind: 'query', key: 'open', constraints: [where('status', '==', 'open')] },
          { kind: 'query', key: `closed-${today}`, constraints: [where('closedAt', '>=', today)] },
        ]
      }
      return dbContext.customerSessionId ? [{ kind: 'doc', id: dbContext.customerSessionId }] : []
    },
  })
  const sessions = coll.items

  const byId         = computed(() => new Map(sessions.value.map((s) => [s.id, s])))
  const openSessions = computed(() =>
    sessions.value.filter((s) => s.status === 'open').sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  )
  const closedToday = computed(() =>
    sessions.value
      .filter((s) => s.status === 'closed' && s.closedAt && isToday(s.closedAt))
      .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))
  )

  const indexRef = (number: string) => doc(firestore!, `${tenantPath()}/openComandas/${number}`)

  // Cliente registrou o cartão: entra na sessão aberta dele ou abre uma nova
  async function openSession(number: string, origin: ComandaSession['origin'], customerName?: string): Promise<ComandaSession> {
    const fresh = (): ComandaSession => ({
      id: newId(), number, origin, customerName, status: 'open', openedAt: new Date().toISOString(), orderIds: [],
    })

    if (!firebaseEnabled) {
      const existing = sessions.value.find((s) => s.status === 'open' && s.number === number)
      if (existing) return existing
      const s = fresh()
      await coll.add(s)
      return s
    }

    const session = await runTransaction(firestore!, async (tx) => {
      const idx = await tx.get(indexRef(number))
      if (idx.exists()) {
        const current = await tx.get(coll.docRef(idx.data().sessionId))
        if (current.exists() && current.data().status === 'open') return { ...current.data(), id: current.id } as ComandaSession
      }
      const s = fresh()
      const { id, ...data } = s
      tx.set(coll.docRef(id), JSON.parse(JSON.stringify(data)))
      if (idx.exists()) tx.update(indexRef(number), { sessionId: id })
      else tx.set(indexRef(number), { sessionId: id })
      return s
    })
    coll.addLocal(session)
    return session
  }

  // Venda direta no caixa (sem cartão): V01, V02… por dia
  async function openDirectSale(): Promise<ComandaSession> {
    const seq = await nextSequence('vendas', true, () =>
      sessions.value.filter((s) => s.number.startsWith('V') && isToday(s.openedAt)).length + 1
    )
    const s: ComandaSession = {
      id: newId(), number: `V${String(seq).padStart(2, '0')}`, origin: 'caixa',
      status: 'open', openedAt: new Date().toISOString(), orderIds: [],
    }
    await coll.add(s)
    return s
  }

  async function patch(id: string, data: Partial<ComandaSession>): Promise<void> {
    const s = sessions.value.find((x) => x.id === id)
    if (!s) return
    Object.assign(s, data)
    await coll.commit()
  }

  const setDestination  = (id: string, destination: Destination) => patch(id, { destination })
  const setCustomerName = (id: string, customerName?: string) => patch(id, { customerName: customerName?.trim() || undefined })

  // Fechar/cancelar libera o cartão físico para a próxima pessoa
  async function finish(id: string, data: Partial<ComandaSession>): Promise<void> {
    const s = sessions.value.find((x) => x.id === id)
    if (!s) return
    Object.assign(s, data)
    await coll.commit()
    if (firebaseEnabled && !s.number.startsWith('V')) {
      const idx = await getDoc(indexRef(s.number))
      if (idx.exists() && idx.data().sessionId === id) {
        const batch = writeBatch(firestore!)
        batch.delete(indexRef(s.number))
        await batch.commit()
      }
    }
  }

  const close  = (id: string, payment: Payment) => finish(id, { status: 'closed', closedAt: payment.paidAt, payment })
  const cancel = (id: string) => finish(id, { status: 'cancelled', closedAt: new Date().toISOString() })

  function nextNfceNumber(): Promise<number> {
    return nextSequence('nfce', false, () =>
      sessions.value.reduce((m, s) => Math.max(m, s.payment?.nfce?.number ?? 0), 0) + 1
    )
  }

  return {
    sessions, byId, openSessions, closedToday,
    openSession, openDirectSale, setDestination, setCustomerName, close, cancel, nextNfceNumber,
    ready: coll.ready, commit: coll.commit, docRef: coll.docRef,
  }
})
