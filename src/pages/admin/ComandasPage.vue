<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Comandas</h1>
        <p class="page__subtitle">{{ comandas.openSessions.length }} abertas · {{ formatMoney(openTotal) }} em consumo</p>
      </div>
      <div class="page__actions">
        <AppButton @click="newDirectSale">+ Venda no balcão</AppButton>
      </div>
    </header>

    <div class="toolbar">
      <div class="segmented">
        <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'open' }]" @click="tab = 'open'">Abertas ({{ comandas.openSessions.length }})</button>
        <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'closed' }]" @click="tab = 'closed'">Fechadas hoje ({{ comandas.closedToday.length }})</button>
      </div>
      <input v-model="search" class="input toolbar__search" inputmode="numeric" placeholder="Nº da comanda ou nome" aria-label="Buscar comanda" />
    </div>

    <section class="panel">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Comanda</th>
              <th>Cliente</th>
              <th>Local</th>
              <th>{{ tab === 'open' ? 'Aberta há' : 'Fechada às' }}</th>
              <th>{{ tab === 'open' ? 'Pedidos' : 'Pagamento' }}</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in rows" :key="c.id" class="is-clickable" @click="selectedId = c.id">
              <td data-label="Comanda"><strong class="num">{{ c.number }}</strong></td>
              <td data-label="Cliente">{{ c.customerName || '—' }}</td>
              <td data-label="Local">{{ destinationLabel(c.destination) }}</td>
              <td data-label="Tempo">
                <template v-if="tab === 'open'">{{ formatDuration(minutesSince(c.openedAt, now)) }}</template>
                <template v-else>{{ formatTime(c.closedAt!) }}</template>
              </td>
              <td data-label="Situação">
                <template v-if="tab === 'open'">
                  <span class="status-dots">
                    <AppBadge v-if="countStatus(c.id, 'ready')" tone="gold">{{ countStatus(c.id, 'ready') }} pronto</AppBadge>
                    <AppBadge v-if="countStatus(c.id, 'received') + countStatus(c.id, 'preparing')" tone="warning">{{ countStatus(c.id, 'received') + countStatus(c.id, 'preparing') }} na cozinha</AppBadge>
                    <AppBadge v-if="!orders.pendingInComanda(c.id).length" tone="success">Servida</AppBadge>
                  </span>
                </template>
                <template v-else>{{ methodLabels[c.payment!.method] }}<AppBadge v-if="c.payment?.nfce" tone="muted" class="ml">NFC-e</AppBadge></template>
              </td>
              <td data-label="Total" class="num"><strong>{{ formatMoney(tab === 'open' ? orders.comandaSubtotal(c.id) : c.payment!.total) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="panel__empty">{{ search ? 'Nenhuma comanda encontrada.' : tab === 'open' ? 'Nenhuma comanda aberta.' : 'Nenhuma comanda fechada hoje.' }}</p>
    </section>
  </div>

  <!-- Detalhe -->
  <AppDrawer
    :model-value="!!selected"
    :title="selected ? comandaLabel(selected.number) : ''"
    :subtitle="subtitle"
    size="lg"
    @update:model-value="selectedId = null"
  >
    <template v-if="selected">
      <div v-if="selectedOrders.length" class="orders">
        <article v-for="o in selectedOrders" :key="o.id" class="order">
          <header class="order__head">
            <span class="order__number">{{ formatOrderNumber(o.number) }}</span>
            <span class="order__meta">{{ formatTime(o.createdAt) }} · {{ destinationLabel(o.destination) }} · {{ o.origin === 'caixa' ? 'lançado no caixa' : 'pelo cliente' }}</span>
            <AppBadge :tone="o.status === 'ready' ? 'gold' : o.status === 'delivered' ? 'success' : 'warning'">{{ statusLabels[o.status] }}</AppBadge>
          </header>
          <ul class="order__items">
            <li v-for="i in o.items" :key="i.id" :class="['item', { 'item--cancelled': i.cancelled }]">
              <span class="item__qty">{{ i.quantity }}×</span>
              <div class="item__info">
                <span>{{ i.productName }}</span>
                <small v-if="i.choices.length">{{ i.choices.map((c) => c.name).join(' · ') }}</small>
                <small v-if="i.cancelled" class="item__cancel-reason">Cancelado por {{ i.cancelled.by }}: {{ i.cancelled.reason }}</small>
              </div>
              <span class="item__price money">{{ formatMoney(i.unitPrice * i.quantity) }}</span>
              <button
                v-if="selected.status === 'open' && !i.cancelled"
                class="item__remove"
                aria-label="Cancelar item"
                title="Cancelar item"
                @click="askCancel(o.id, i.id, i.productName)"
              >✕</button>
            </li>
          </ul>
          <p v-if="o.note" class="order__note">Obs.: {{ o.note }}</p>
        </article>
      </div>
      <p v-else class="empty">Nenhum pedido nesta comanda ainda.</p>

      <div class="totals">
        <div><span>Subtotal</span><span class="money">{{ formatMoney(orders.comandaSubtotal(selected.id)) }}</span></div>
        <template v-if="selected.payment">
          <div v-if="selected.payment.discount"><span>Desconto</span><span class="money">−{{ formatMoney(selected.payment.discount) }}</span></div>
          <div v-if="selected.payment.serviceFee"><span>Taxa de serviço</span><span class="money">{{ formatMoney(selected.payment.serviceFee) }}</span></div>
          <div class="totals__grand"><span>Pago · {{ methodLabels[selected.payment.method] }}</span><span class="money">{{ formatMoney(selected.payment.total) }}</span></div>
          <div v-if="selected.payment.parts" class="totals__parts">
            <span v-for="p in selected.payment.parts" :key="p.method">{{ methodLabels[p.method] }} {{ formatMoney(p.amount) }}</span>
          </div>
          <div class="totals__meta"><span>Recebido por {{ selected.payment.operator }} às {{ formatTime(selected.payment.paidAt) }}</span></div>
        </template>
      </div>
    </template>

    <template v-if="selected" #footer>
      <template v-if="selected.status === 'open'">
        <AppButton v-if="!selectedOrders.length" variant="ghost" @click="cancelEmpty">Cancelar comanda</AppButton>
        <AppButton variant="outline" @click="addFor = selected">+ Adicionar itens</AppButton>
        <AppButton variant="success" :disabled="!orders.comandaSubtotal(selected.id)" @click="payFor = selected">Fechar conta →</AppButton>
      </template>
      <AppButton v-else-if="selected.payment?.nfce" variant="outline" @click="receiptFor = selected">Ver NFC-e</AppButton>
    </template>
  </AppDrawer>

  <!-- Cancelar item -->
  <AppModal :model-value="!!cancelTarget" title="Cancelar item" size="sm" @update:model-value="cancelTarget = null">
    <div v-if="cancelTarget" class="form-stack">
      <p>Cancelar <strong>{{ cancelTarget.name }}</strong>? O item sai do total da comanda e da fila da cozinha.</p>
      <div class="field">
        <span class="field__label">Motivo</span>
        <select v-model="cancelReason" class="select">
          <option>Lançado por engano</option>
          <option>Cliente desistiu</option>
          <option>Produto indisponível</option>
          <option>Problema no preparo</option>
        </select>
      </div>
    </div>
    <template #footer>
      <AppButton variant="ghost" @click="cancelTarget = null">Voltar</AppButton>
      <AppButton variant="danger" @click="confirmCancel">Cancelar item</AppButton>
    </template>
  </AppModal>

  <AddItemsModal :session="addFor" @close="addFor = null" />
  <PaymentModal :session="payFor" @close="payFor = null" @paid="onPaid" />
  <NfceReceipt :session="receiptFor" @close="receiptFor = null" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import type { ComandaSession, NfceDoc, OrderStatus } from '@/types'
import { useComandasStore } from '@/stores/useComandasStore'
import { useOrderStore, statusLabels } from '@/stores/useOrderStore'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useToastStore }    from '@/stores/useToastStore'
import { useNow } from '@/composables/useNow'
import {
  formatMoney, formatTime, formatDuration, formatOrderNumber, minutesSince,
  destinationLabel, comandaLabel, methodLabels,
} from '@/lib/format'
import AppButton     from '@/components/ui/AppButton.vue'
import AppBadge      from '@/components/ui/AppBadge.vue'
import AppDrawer     from '@/components/ui/AppDrawer.vue'
import AppModal      from '@/components/ui/AppModal.vue'
import AddItemsModal from '@/components/admin/AddItemsModal.vue'
import PaymentModal  from '@/components/admin/PaymentModal.vue'
import NfceReceipt   from '@/components/admin/NfceReceipt.vue'

const comandas = useComandasStore()
const orders   = useOrderStore()
const staff    = useStaffStore()
const toast    = useToastStore()
const route    = useRoute()
const now      = useNow(30_000)

const tab    = ref<'open' | 'closed'>('open')
const search = ref(typeof route.query.c === 'string' ? route.query.c : '')

const openTotal = computed(() => comandas.openSessions.reduce((s, c) => s + orders.comandaSubtotal(c.id), 0))

const rows = computed(() => {
  const list = tab.value === 'open' ? comandas.openSessions : comandas.closedToday
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  const digits = q.replace(/\D/g, '')
  return list.filter((c) =>
    (digits && c.number.replace(/\D/g, '').includes(digits.replace(/^0+/, ''))) ||
    c.customerName?.toLowerCase().includes(q)
  )
})

function countStatus(comandaId: string, status: OrderStatus): number {
  return orders.byComanda(comandaId).filter((o) => o.status === status).length
}

// --- Detalhe ---
const selectedId     = ref<string | null>(null)
const selected       = computed(() => (selectedId.value ? comandas.byId.get(selectedId.value) ?? null : null))
const selectedOrders = computed(() => (selected.value ? orders.byComanda(selected.value.id) : []))
const subtitle = computed(() => {
  const s = selected.value
  if (!s) return ''
  const parts = [s.customerName, destinationLabel(s.destination), `aberta às ${formatTime(s.openedAt)}`].filter(Boolean)
  return parts.join(' · ')
})

// --- Venda direta ---
async function newDirectSale() {
  const s = await comandas.openDirectSale()
  selectedId.value = s.id
  addFor.value = s
}

async function cancelEmpty() {
  if (!selected.value) return
  await comandas.cancel(selected.value.id)
  selectedId.value = null
  toast.add('Comanda cancelada.', 'info')
}

// --- Cancelar item ---
const cancelTarget = ref<{ orderId: string; itemId: string; name: string } | null>(null)
const cancelReason = ref('Lançado por engano')

function askCancel(orderId: string, itemId: string, name: string) {
  cancelTarget.value = { orderId, itemId, name }
  cancelReason.value = 'Lançado por engano'
}

function confirmCancel() {
  if (!cancelTarget.value) return
  orders.cancelItem(cancelTarget.value.orderId, cancelTarget.value.itemId, staff.user?.name ?? 'Caixa', cancelReason.value)
  toast.add(`${cancelTarget.value.name} cancelado.`, 'info')
  cancelTarget.value = null
}

// --- Itens, pagamento, NFC-e ---
const addFor     = ref<ComandaSession | null>(null)
const payFor     = ref<ComandaSession | null>(null)
const receiptFor = ref<ComandaSession | null>(null)

function onPaid(session: ComandaSession, nfce: NfceDoc | null) {
  payFor.value = null
  selectedId.value = null
  toast.add(`${comandaLabel(session.number)} fechada · ${formatMoney(session.payment!.total)}`, 'success')
  if (!nfce) return
  if (nfce.status === 'autorizada' || nfce.status === 'contingencia') receiptFor.value = session
  else if (nfce.status === 'rejeitada') toast.add(`NFC-e rejeitada: ${nfce.mensagem ?? 'veja em Fiscal'}`, 'error')
  else toast.add('NFC-e pendente: o provedor não respondeu. Consulte em Fiscal.', 'info')
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  &__search { max-width: 260px; }
}

.status-dots { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.ml { margin-left: 6px; }

.orders { display: flex; flex-direction: column; gap: var(--spacing-md); }

.order {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-surface-alt);
  }

  &__number { font-family: var(--font-mono); font-weight: 500; }
  &__meta { flex: 1; font-size: 0.75rem; color: var(--color-text-muted); }
  &__items { padding: var(--spacing-xs) var(--spacing-md); }
  &__note { padding: 0 var(--spacing-md) var(--spacing-sm); font-size: 0.8125rem; color: var(--color-text-muted); }
}

.item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
  &:last-child { border-bottom: none; }

  &--cancelled { opacity: 0.5; .item__info > span, .item__price { text-decoration: line-through; } }

  &__qty { font-family: var(--font-mono); color: var(--color-accent-text); width: 28px; }
  &__info { flex: 1; min-width: 0; display: flex; flex-direction: column; small { color: var(--color-text-muted); font-size: 0.75rem; } }
  &__cancel-reason { color: var(--color-danger) !important; }
  &__price { white-space: nowrap; }

  &__remove {
    @include button-reset;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    &:hover { color: var(--color-danger); background: var(--color-danger-soft); }
  }
}

.empty { color: var(--color-text-muted); font-size: 0.875rem; }

.totals {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9375rem;

  > div { display: flex; justify-content: space-between; }
  &__grand { font-weight: 600; padding-top: 6px; border-top: 1px solid var(--color-border); .money { color: var(--color-accent-text); } }
  &__parts { gap: var(--spacing-md); justify-content: flex-end !important; font-size: 0.8125rem; color: var(--color-text-muted); }
  &__meta { font-size: 0.75rem; color: var(--color-text-muted); }
}
</style>
