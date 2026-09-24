import { watch, type Ref } from 'vue'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useToastStore }    from '@/stores/useToastStore'
import { formatOrderNumber } from '@/lib/format'

// Avisa o cliente quando a cozinha começa e quando o pedido fica pronto.
// Mock: observa a store (que ouve as outras abas). Com backend, vira push notification.
export function useReadyNotifier(enabled: Ref<boolean>): void {
  const orders   = useOrderStore()
  const customer = useCustomerStore()
  const toast    = useToastStore()

  const snapshot = () =>
    customer.sessionId
      ? orders.byComanda(customer.sessionId).map((o) => `${o.id}:${o.status}`).join(',')
      : ''

  const lastStatus = new Map<string, string>()

  watch(snapshot, () => {
    if (!customer.sessionId) { lastStatus.clear(); return }
    orders.byComanda(customer.sessionId).forEach((o) => {
      const before = lastStatus.get(o.id)
      lastStatus.set(o.id, o.status)
      if (!enabled.value || !before || before === o.status) return
      if (o.status === 'ready') {
        navigator.vibrate?.([200, 100, 200])
        toast.add(
          o.destination.type === 'mesa'
            ? `Pedido ${formatOrderNumber(o.number)} pronto! Já está indo até a mesa ${o.destination.table}.`
            : `Pedido ${formatOrderNumber(o.number)} pronto! Retire no balcão.`,
          'success'
        )
      } else if (o.status === 'preparing') {
        toast.add(`A cozinha começou o pedido ${formatOrderNumber(o.number)}.`, 'info')
      } else if (o.status === 'delivered' && o.destination.type === 'mesa') {
        toast.add(`Pedido ${formatOrderNumber(o.number)} entregue. Bom apetite!`, 'success')
      }
    })
  }, { immediate: true })
}
