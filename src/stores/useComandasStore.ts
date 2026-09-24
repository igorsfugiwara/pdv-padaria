import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { ComandaSession, Destination, Payment } from '@/types'
import { persisted } from '@/db/persisted'
import { liveSeed } from '@/db/seed'
import { isToday } from '@/lib/format'
import { newId } from '@/lib/ids'

// Sessões de comanda. O cartão físico é reutilizado: cada vez que ele volta a
// circular depois de pago, nasce uma sessão nova com o mesmo número.
export const useComandasStore = defineStore('comandas', () => {
  const { data: sessions, commit } = persisted<ComandaSession[]>('comandas', () => liveSeed().comandas)

  const byId        = computed(() => new Map(sessions.value.map((s) => [s.id, s])))
  const openSessions = computed(() =>
    sessions.value.filter((s) => s.status === 'open').sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  )
  const closedToday = computed(() =>
    sessions.value
      .filter((s) => s.status === 'closed' && s.closedAt && isToday(s.closedAt))
      .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))
  )

  function openByNumber(number: string): ComandaSession | undefined {
    return sessions.value.find((s) => s.status === 'open' && s.number === number)
  }

  // Cliente escaneou: entra na sessão aberta desse cartão ou abre uma nova
  function openSession(number: string, origin: ComandaSession['origin'], customerName?: string): ComandaSession {
    const existing = openByNumber(number)
    if (existing) return existing
    const s: ComandaSession = {
      id: newId(), number, origin, customerName, status: 'open', openedAt: new Date().toISOString(),
    }
    sessions.value.push(s)
    commit()
    return s
  }

  // Venda direta no caixa (sem cartão): V01, V02… por dia
  function openDirectSale(): ComandaSession {
    const today = sessions.value.filter((s) => s.number.startsWith('V') && isToday(s.openedAt)).length
    return openSession(`V${String(today + 1).padStart(2, '0')}`, 'caixa')
  }

  function patch(id: string, data: Partial<ComandaSession>): void {
    const i = sessions.value.findIndex((s) => s.id === id)
    if (i >= 0) {
      sessions.value[i] = { ...sessions.value[i], ...data }
      commit()
    }
  }

  const setDestination = (id: string, destination: Destination) => patch(id, { destination })
  const setCustomerName = (id: string, customerName?: string) => patch(id, { customerName: customerName?.trim() || undefined })

  function close(id: string, payment: Payment): void {
    patch(id, { status: 'closed', closedAt: payment.paidAt, payment })
  }

  function cancel(id: string): void {
    patch(id, { status: 'cancelled', closedAt: new Date().toISOString() })
  }

  function nextNfceNumber(): number {
    return sessions.value.reduce((m, s) => Math.max(m, s.payment?.nfce?.number ?? 0), 0) + 1
  }

  return { sessions, byId, openSessions, closedToday, openByNumber, openSession, openDirectSale, setDestination, setCustomerName, close, cancel, nextNfceNumber }
})
