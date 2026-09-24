<template>
  <div class="salon">
    <StaffHeader title="Salão">
      <div class="segmented" role="tablist">
        <button :class="['segmented__btn', { 'segmented__btn--active': view === 'painel' }]" @click="view = 'painel'">Painel</button>
        <button :class="['segmented__btn', { 'segmented__btn--active': view === 'mesas' }]" @click="view = 'mesas'">Mesas</button>
      </div>
    </StaffHeader>

    <!-- Resumo: o que precisa de atenção agora -->
    <div class="summary">
      <div class="summary__item summary__item--ready">
        <strong>{{ ready.length }}</strong><span>Prontos para levar</span>
      </div>
      <div class="summary__item summary__item--ok">
        <strong>{{ inKitchen.filter((o) => levelOf(o) === 'ok').length }}</strong><span>No prazo</span>
      </div>
      <div class="summary__item summary__item--warn">
        <strong>{{ inKitchen.filter((o) => levelOf(o) === 'warn').length }}</strong><span>Atenção</span>
      </div>
      <div class="summary__item summary__item--late">
        <strong>{{ inKitchen.filter((o) => levelOf(o) === 'late').length }}</strong><span>Atrasados</span>
      </div>
    </div>

    <!-- ── Painel ── -->
    <main v-if="view === 'painel'" class="board">
      <section class="board__section">
        <h2 class="board__title">Prontos para levar</h2>
        <TransitionGroup name="card" tag="div" class="ready-grid">
          <article
            v-for="o in ready"
            :key="o.id"
            :class="['ready', `ready--${waitLevel(o)}`]"
          >
            <header class="ready__head">
              <span class="ready__dest">{{ destinationLabel(o.destination) }}</span>
              <span class="ready__number">{{ formatOrderNumber(o.number) }}</span>
            </header>
            <p class="ready__who">
              Comanda {{ o.comandaNumber }}<template v-if="o.customerName"> · {{ o.customerName }}</template>
            </p>
            <ul class="ready__items">
              <li v-for="i in activeItems(o)" :key="i.id"><strong>{{ i.quantity }}×</strong> {{ i.productName }}</li>
            </ul>
            <p class="ready__wait">
              Pronto há {{ Math.floor(waitingMinutes(o, now)) }} min
              <template v-if="waitLevel(o) !== 'ok'"> · {{ waitLevel(o) === 'late' ? 'esfriando' : 'levar agora' }}</template>
            </p>
            <AppButton size="lg" full-width :variant="o.destination.type === 'mesa' ? 'primary' : 'outline'" @click="deliver(o)">
              {{ o.destination.type === 'mesa' ? `Entregue na mesa ${o.destination.table}` : 'Cliente retirou' }}
            </AppButton>
          </article>
        </TransitionGroup>
        <p v-if="!ready.length" class="board__empty">Nada pronto agora. Os pedidos aparecem aqui assim que a cozinha libera.</p>
      </section>

      <section class="board__section">
        <h2 class="board__title">
          Na cozinha
          <span class="board__legend">cor pelo tempo desde o pedido · {{ settings.warnMinutes }} e {{ settings.lateMinutes }} min</span>
        </h2>
        <TransitionGroup name="card" tag="div" class="kitchen-grid">
          <button
            v-for="o in inKitchen"
            :key="o.id"
            :class="['tile', `tile--${levelOf(o)}`]"
            @click="detail = o.id"
          >
            <span class="tile__number">{{ formatOrderNumber(o.number) }}</span>
            <span class="tile__dest">{{ destinationLabel(o.destination) }}</span>
            <span class="tile__time">{{ Math.floor(kitchenMinutes(o, now)) }} min</span>
            <span class="tile__status">{{ o.status === 'received' ? 'Aguardando' : 'Em preparo' }} · {{ levelLabels[levelOf(o)] }}</span>
          </button>
        </TransitionGroup>
        <p v-if="!inKitchen.length" class="board__empty">Cozinha sem pedidos em andamento.</p>
      </section>

      <section v-if="recentlyDelivered.length" class="board__section">
        <h2 class="board__title">Entregues há pouco</h2>
        <ul class="recent">
          <li v-for="o in recentlyDelivered" :key="o.id" class="recent__row">
            <span class="recent__number">{{ formatOrderNumber(o.number) }}</span>
            <span class="recent__dest">{{ destinationLabel(o.destination) }}</span>
            <span class="recent__meta">{{ formatTime(o.deliveredAt!) }} · {{ o.deliveredBy ? roleLabels[o.deliveredBy] : '' }}</span>
            <button class="recent__undo" @click="orders.revert(o.id)">Desfazer</button>
          </li>
        </ul>
      </section>
    </main>

    <!-- ── Mesas ── -->
    <main v-else class="board">
      <div class="tables">
        <button
          v-for="t in tableCards"
          :key="t.key"
          :class="['table', {
            'table--free': !t.comandas.length,
            'table--ready': t.ready > 0,
            [`table--${t.level}`]: t.cooking > 0 && !t.ready,
          }]"
          @click="t.comandas.length && (tableDetail = t.key)"
        >
          <span class="table__name">{{ t.label }}</span>
          <template v-if="t.comandas.length">
            <span class="table__who">{{ t.names || `${t.comandas.length} comanda${t.comandas.length > 1 ? 's' : ''}` }}</span>
            <span class="table__state">
              <template v-if="t.ready">🔔 {{ t.ready }} pronto{{ t.ready > 1 ? 's' : '' }}</template>
              <template v-else-if="t.cooking">{{ t.cooking }} na cozinha</template>
              <template v-else>Servida</template>
            </span>
          </template>
          <span v-else class="table__state">Livre</span>
        </button>
      </div>
    </main>
  </div>

  <!-- Detalhe de um pedido na cozinha -->
  <AppSheet :model-value="!!detailOrder" :title="detailOrder ? `Pedido ${formatOrderNumber(detailOrder.number)}` : ''" @update:model-value="detail = null">
    <div v-if="detailOrder" class="detail">
      <p class="detail__meta">
        {{ destinationLabel(detailOrder.destination) }} · Comanda {{ detailOrder.comandaNumber }}
        <template v-if="detailOrder.customerName"> · {{ detailOrder.customerName }}</template>
      </p>
      <p class="detail__meta">Enviado às {{ formatTime(detailOrder.createdAt) }} · {{ statusLabels[detailOrder.status] }}</p>
      <ul class="detail__items">
        <li v-for="i in activeItems(detailOrder)" :key="i.id">
          <strong>{{ i.quantity }}×</strong> {{ i.productName }}
          <small v-if="i.choices.length">{{ i.choices.map((c) => c.name).join(' · ') }}</small>
          <small v-if="i.note" class="detail__note">⚠ {{ i.note }}</small>
        </li>
      </ul>
      <p v-if="detailOrder.note" class="detail__note">⚠ {{ detailOrder.note }}</p>
    </div>
  </AppSheet>

  <!-- Detalhe de uma mesa -->
  <AppSheet :model-value="!!tableDetailCard" :title="tableDetailCard?.label ?? ''" @update:model-value="tableDetail = null">
    <div v-if="tableDetailCard" class="detail">
      <div v-for="o in tableDetailCard.orders" :key="o.id" class="detail__order">
        <div class="detail__order-head">
          <strong>{{ formatOrderNumber(o.number) }}</strong>
          <span>Comanda {{ o.comandaNumber }}<template v-if="o.customerName"> · {{ o.customerName }}</template></span>
          <AppBadge :tone="o.status === 'ready' ? 'gold' : o.status === 'delivered' ? 'muted' : 'warning'">{{ statusLabels[o.status] }}</AppBadge>
        </div>
        <p class="detail__line">{{ activeItems(o).map((i) => `${i.quantity}× ${i.productName}`).join(', ') }}</p>
        <AppButton v-if="o.status === 'ready'" size="md" full-width @click="deliver(o)">Entregue na mesa</AppButton>
      </div>
    </div>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Order } from '@/types'
import { useOrderStore, statusLabels } from '@/stores/useOrderStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useToastStore }    from '@/stores/useToastStore'
import { useNow } from '@/composables/useNow'
import { formatOrderNumber, formatTime, destinationLabel, roleLabels } from '@/lib/format'
import { kitchenMinutes, waitingMinutes, timeLevel, levelLabels, type TimeLevel } from '@/lib/timing'
import StaffHeader from '@/components/staff/StaffHeader.vue'
import AppButton   from '@/components/ui/AppButton.vue'
import AppSheet    from '@/components/ui/AppSheet.vue'
import AppBadge    from '@/components/ui/AppBadge.vue'

const orders   = useOrderStore()
const comandas = useComandasStore()
const settings = useSettingsStore().settings
const toast    = useToastStore()
const now      = useNow(10_000)

const view = ref<'painel' | 'mesas'>('painel')

const activeItems = (o: Order) => o.items.filter((i) => !i.cancelled)

// Prontos: quem espera há mais tempo primeiro
const ready = computed(() =>
  orders.active.filter((o) => o.status === 'ready').sort((a, b) => (a.readyAt ?? '').localeCompare(b.readyAt ?? ''))
)

// Na cozinha: mais antigos primeiro (são os que mais precisam de olho)
const inKitchen = computed(() =>
  orders.active.filter((o) => o.status !== 'ready').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
)

const recentlyDelivered = computed(() =>
  orders.orders
    .filter((o) => o.status === 'delivered' && o.deliveredAt && o.deliveredBy !== 'caixa' && now.value - new Date(o.deliveredAt).getTime() < 15 * 60_000)
    .sort((a, b) => b.deliveredAt!.localeCompare(a.deliveredAt!))
    .slice(0, 6)
)

function levelOf(o: Order): TimeLevel {
  return timeLevel(kitchenMinutes(o, now.value), settings)
}

function waitLevel(o: Order): TimeLevel {
  const w = waitingMinutes(o, now.value)
  return w >= 6 ? 'late' : w >= 3 ? 'warn' : 'ok'
}

function deliver(o: Order) {
  orders.advance(o.id, 'salao')
  toast.add(`${formatOrderNumber(o.number)} entregue · ${destinationLabel(o.destination)}`, 'success')
  if (tableDetailCard.value && !tableDetailCard.value.orders.some((x) => x.status === 'ready')) tableDetail.value = null
}

// --- Detalhe de pedido ---
const detail      = ref<string | null>(null)
const detailOrder = computed(() => orders.orders.find((o) => o.id === detail.value) ?? null)

// --- Mesas ---
interface TableCard {
  key: string
  label: string
  comandas: string[]
  names: string
  orders: Order[]
  ready: number
  cooking: number
  level: TimeLevel
}

const tableCards = computed<TableCard[]>(() => {
  const openIds = new Set(comandas.openSessions.map((s) => s.id))
  const openOrders = orders.orders.filter((o) => openIds.has(o.comandaId))
  const keyOf = (o: Order) => (o.destination.type === 'mesa' ? `mesa-${o.destination.table}` : o.destination.type)

  const keys = [
    ...Array.from({ length: settings.tables }, (_, i) => ({ key: `mesa-${i + 1}`, label: `Mesa ${i + 1}` })),
    { key: 'balcao', label: 'Balcão' },
    { key: 'viagem', label: 'Para viagem' },
  ]

  return keys.map(({ key, label }) => {
    const mine    = openOrders.filter((o) => keyOf(o) === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const cooking = mine.filter((o) => o.status === 'received' || o.status === 'preparing')
    const worst   = cooking.reduce<TimeLevel>((lvl, o) => {
      const l = levelOf(o)
      return l === 'late' || (l === 'warn' && lvl === 'ok') ? l : lvl
    }, 'ok')
    const sessionIds = [...new Set(mine.map((o) => o.comandaId))]
    const names = [...new Set(mine.map((o) => o.customerName).filter(Boolean))].join(', ')
    return {
      key, label,
      comandas: sessionIds,
      names,
      orders: mine,
      ready: mine.filter((o) => o.status === 'ready').length,
      cooking: cooking.length,
      level: worst,
    }
  })
})

const tableDetail     = ref<string | null>(null)
const tableDetailCard = computed(() => tableCards.value.find((t) => t.key === tableDetail.value) ?? null)
</script>

<style lang="scss" scoped>
.salon { min-height: 100dvh; display: flex; flex-direction: column; }

.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--color-border);
  border-bottom: 1px solid var(--color-border);

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-xs);
    background: var(--color-surface);
    text-align: center;

    strong { font-size: 1.5rem; line-height: 1.1; font-weight: 600; }
    span { font-size: 0.6875rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }

    &--ready strong { color: var(--color-accent-text); }
    &--ok strong    { color: var(--color-success); }
    &--warn strong  { color: var(--color-warning); }
    &--late strong  { color: var(--color-danger); }
  }
}

.board {
  flex: 1;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &__section { display: flex; flex-direction: column; gap: var(--spacing-sm); }

  &__title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  &__legend { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 0.75rem; }

  &__empty {
    padding: var(--spacing-lg);
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
  }
}

// Prontos: cartão dourado grande, fácil de achar de longe
.ready-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.ready {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  border: 2px solid var(--color-primary);

  &--warn { animation: glow 1.6s ease-in-out infinite; }
  &--late { border-color: var(--color-danger); animation: glow-late 1.2s ease-in-out infinite; }

  &__head { @include flex-between; }
  &__dest { font-size: 1.5rem; font-weight: 700; color: var(--color-accent-text); }
  &__number { font-family: var(--font-mono); font-size: 1rem; color: var(--color-text-muted); }
  &__who { font-size: 0.8125rem; color: var(--color-text-muted); margin-top: -6px; }
  &__items { font-size: 0.9375rem; display: flex; flex-direction: column; gap: 2px; strong { color: var(--color-accent-text); } }
  &__wait { font-size: 0.8125rem; color: var(--color-text-muted); }
  &--late &__wait { color: var(--color-danger); font-weight: 600; }
}

// Na cozinha: tiles coloridos pelo tempo (verde → laranja → vermelho)
.kitchen-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.tile {
  @include button-reset;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  text-align: left;
  border: 1px solid transparent;
  transition: transform var(--transition);

  &:active { transform: scale(0.98); }

  &--ok   { background: var(--color-success-soft); border-color: var(--color-success); }
  &--warn { background: var(--color-warning-soft); border-color: var(--color-warning); }
  &--late { background: var(--color-danger-soft);  border-color: var(--color-danger); animation: pulse-late 1.6s ease-in-out infinite; }

  &__number { font-family: var(--font-mono); font-size: 1.375rem; font-weight: 500; }
  &__dest   { font-weight: 600; }
  &__time   { font-family: var(--font-mono); font-size: 1.125rem; margin-top: 4px; }
  &--ok &__time   { color: var(--color-success); }
  &--warn &__time { color: var(--color-warning); }
  &--late &__time { color: var(--color-danger); }
  &__status { font-size: 0.75rem; color: var(--color-text-muted); }
}

.recent {
  @include card;
  padding: 0;

  &__row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: 10px var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.875rem;
    &:last-child { border-bottom: none; }
  }

  &__number { font-family: var(--font-mono); }
  &__dest   { font-weight: 500; }
  &__meta   { flex: 1; color: var(--color-text-muted); font-size: 0.8125rem; }
  &__undo {
    @include button-reset;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    text-decoration: underline;
    &:hover { color: var(--color-text); }
  }
}

.tables {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--spacing-sm);
}

.table {
  @include button-reset;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 96px;
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  text-align: left;

  &--free { opacity: 0.45; cursor: default; }
  &--ok   { border-color: var(--color-success); }
  &--warn { border-color: var(--color-warning); background: var(--color-warning-soft); }
  &--late { border-color: var(--color-danger); background: var(--color-danger-soft); }
  &--ready { border: 2px solid var(--color-primary); background: var(--color-primary-soft); }

  &__name  { font-weight: 700; font-size: 1.0625rem; }
  &__who   { font-size: 0.8125rem; color: var(--color-text-muted); @include truncate; }
  &__state { margin-top: auto; font-size: 0.8125rem; font-weight: 500; }
  &--ready &__state { color: var(--color-accent-text); }
}

.detail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &__meta { font-size: 0.875rem; color: var(--color-text-muted); }

  &__items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
    small { display: block; color: var(--color-text-muted); font-size: 0.8125rem; }
  }

  &__note { color: var(--color-warning) !important; font-weight: 600; }

  &__order {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--color-border);
  }

  &__order-head { display: flex; align-items: center; gap: var(--spacing-sm); span { flex: 1; font-size: 0.8125rem; color: var(--color-text-muted); } }
  &__line { font-size: 0.9375rem; }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50%      { box-shadow: 0 0 0 4px var(--color-primary-soft); }
}
@keyframes glow-late {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50%      { box-shadow: 0 0 0 4px var(--color-danger-soft); }
}
@keyframes pulse-late {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50%      { box-shadow: 0 0 0 3px var(--color-danger-soft); }
}

.card-move, .card-enter-active, .card-leave-active { transition: all 250ms ease; }
.card-enter-from, .card-leave-to { opacity: 0; transform: scale(0.96); }
.card-leave-active { position: absolute; }
</style>
