<template>
  <div class="kitchen">
    <StaffHeader title="Cozinha">
      <button class="head-btn" @click="showAvailability = true">Disponibilidade</button>
    </StaffHeader>

    <div class="kitchen__bar">
      <div class="kitchen__filters" role="group" aria-label="Filtrar por estação">
        <button
          v-for="s in stationFilters"
          :key="s.value"
          :class="['chip', { 'chip--active': station === s.value }]"
          @click="station = s.value"
        >{{ s.label }}</button>
      </div>
      <div class="legend" aria-label="Legenda de tempo">
        <span class="legend__item legend__item--ok">até {{ settings.warnMinutes }} min</span>
        <span class="legend__item legend__item--warn">{{ settings.warnMinutes }}–{{ settings.lateMinutes }} min</span>
        <span class="legend__item legend__item--late">+{{ settings.lateMinutes }} min</span>
      </div>
    </div>

    <!-- Abas por status (celular e tablet em pé) -->
    <nav class="kitchen__tabs">
      <button
        v-for="col in columns"
        :key="col.status"
        :class="['ktab', { 'ktab--active': tab === col.status }]"
        @click="tab = col.status"
      >
        {{ col.label }}
        <span :class="['ktab__count', `ktab__count--${col.status}`]">{{ ordersIn(col.status).length }}</span>
      </button>
    </nav>

    <div class="kitchen__board">
      <section
        v-for="col in columns"
        :key="col.status"
        :class="['column', `column--${col.status}`, { 'column--hidden-mobile': tab !== col.status }]"
      >
        <h2 class="column__title">
          {{ col.label }}
          <span class="column__count">{{ ordersIn(col.status).length }}</span>
        </h2>

        <TransitionGroup name="ticket" tag="div" class="column__list">
          <article
            v-for="order in ordersIn(col.status)"
            :key="order.id"
            :class="['ticket', `ticket--${levelOf(order)}`, { 'ticket--fresh': freshIds.has(order.id) }]"
          >
            <header class="ticket__header">
              <span class="ticket__number">{{ formatOrderNumber(order.number) }}</span>
              <div class="ticket__who">
                <strong>{{ destinationLabel(order.destination) }}</strong>
                <span>Comanda {{ order.comandaNumber }}<template v-if="order.customerName"> · {{ order.customerName }}</template></span>
              </div>
              <span class="ticket__age" :title="levelLabels[levelOf(order)]">
                {{ Math.floor(order.status === 'ready' ? waitingMinutes(order, now) : kitchenMinutes(order, now)) }} min
              </span>
            </header>

            <ul class="ticket__items">
              <li v-for="item in itemsFor(order)" :key="item.id" :class="['ticket__item', { 'ticket__item--cancelled': item.cancelled }]">
                <span class="ticket__qty">{{ item.quantity }}</span>
                <div class="ticket__item-body">
                  <span class="ticket__name">{{ item.productName }}</span>
                  <span v-if="station === 'all'" class="ticket__station">{{ stationLabels[item.station] }}</span>
                  <span v-if="item.choices.length" class="ticket__choices">{{ item.choices.map((c) => c.name).join(' · ') }}</span>
                  <span v-if="item.note" class="ticket__note">⚠ {{ item.note }}</span>
                  <span v-if="item.cancelled" class="ticket__note">Cancelado no caixa</span>
                </div>
              </li>
            </ul>
            <p v-if="hiddenCount(order)" class="ticket__others">
              + {{ hiddenCount(order) }} {{ hiddenCount(order) === 1 ? 'item' : 'itens' }} de outras estações
            </p>
            <p v-if="order.note" class="ticket__order-note">⚠ {{ order.note }}</p>
            <p v-if="order.destination.type === 'viagem'" class="ticket__order-note ticket__order-note--pack">🥡 Embalar para viagem</p>

            <footer class="ticket__actions">
              <button
                v-if="order.status !== 'received'"
                class="ticket__undo"
                aria-label="Voltar etapa"
                title="Voltar etapa"
                @click="orders.revert(order.id)"
              >↶</button>
              <AppButton
                :variant="col.status === 'received' ? 'primary' : col.status === 'preparing' ? 'success' : 'outline'"
                size="lg"
                full-width
                @click="orders.advance(order.id, 'cozinha')"
              >{{ col.action }}</AppButton>
            </footer>
          </article>
        </TransitionGroup>

        <p v-if="!ordersIn(col.status).length" class="column__empty">{{ col.empty }}</p>
      </section>
    </div>
  </div>

  <!-- Esgotar / liberar itens sem sair da cozinha -->
  <AppDrawer v-model="showAvailability" title="Disponibilidade" subtitle="Esgote um item e ele some do pedido do cliente na hora">
    <input v-model="availSearch" class="input avail-search" placeholder="Buscar produto" />
    <ul class="avail">
      <li v-for="p in availProducts" :key="p.id" class="avail__row">
        <span class="avail__emoji">{{ p.emoji }}</span>
        <div class="avail__info">
          <span>{{ p.name }}</span>
          <small v-if="catalog.missingInsumo(p)" class="avail__warn">Sem {{ catalog.missingInsumo(p)!.name.toLowerCase() }} no estoque</small>
          <small v-else-if="!p.available" class="avail__warn">Esgotado manualmente</small>
        </div>
        <button
          :class="['switch', { 'switch--on': p.available }]"
          role="switch"
          :aria-checked="p.available"
          :aria-label="`${p.name} disponível`"
          @click="catalog.toggleAvailable(p.id)"
        />
      </li>
    </ul>
  </AppDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Order, OrderItem, OrderStatus, Station } from '@/types'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useToastStore }    from '@/stores/useToastStore'
import { useNow } from '@/composables/useNow'
import { formatOrderNumber, destinationLabel, stationLabels } from '@/lib/format'
import { kitchenMinutes, waitingMinutes, timeLevel, levelLabels, type TimeLevel } from '@/lib/timing'
import StaffHeader from '@/components/staff/StaffHeader.vue'
import AppButton   from '@/components/ui/AppButton.vue'
import AppDrawer   from '@/components/ui/AppDrawer.vue'

const orders   = useOrderStore()
const catalog  = useCatalogStore()
const settings = useSettingsStore().settings
const toast    = useToastStore()
const now      = useNow(15_000)

const columns: { status: OrderStatus; label: string; action: string; empty: string }[] = [
  { status: 'received',  label: 'Novos',      action: 'Iniciar preparo',    empty: 'Nenhum pedido novo' },
  { status: 'preparing', label: 'Em preparo', action: 'Marcar como pronto', empty: 'Nada no fogo' },
  { status: 'ready',     label: 'Prontos',    action: 'Saiu da cozinha',    empty: 'Nada esperando o salão' },
]
const tab = ref<OrderStatus>('received')

type StationFilter = Station | 'all'
const stationFilters: { value: StationFilter; label: string }[] = [
  { value: 'all',     label: 'Todas' },
  { value: 'cozinha', label: stationLabels.cozinha },
  { value: 'cafe',    label: stationLabels.cafe },
  { value: 'balcao',  label: stationLabels.balcao },
]
const station = ref<StationFilter>('all')

function itemsFor(order: Order): OrderItem[] {
  return station.value === 'all' ? order.items : order.items.filter((i) => i.station === station.value)
}

function hiddenCount(order: Order): number {
  return order.items.length - itemsFor(order).length
}

function ordersIn(status: OrderStatus): Order[] {
  return orders.active
    .filter((o) => o.status === status && itemsFor(o).length > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))   // mais antigo primeiro
}

// Na fila: tempo desde o envio. Pronto: tempo esperando o salão (atenção já a partir de 3 min)
function levelOf(order: Order): TimeLevel {
  if (order.status === 'ready') {
    const w = waitingMinutes(order, now.value)
    return w >= 6 ? 'late' : w >= 3 ? 'warn' : 'ok'
  }
  return timeLevel(kitchenMinutes(order, now.value), settings)
}

// --- Pedido novo chegando (de outra aba/aparelho) ---
const freshIds = ref(new Set<string>())
const knownIds = new Set(orders.orders.map((o) => o.id))

watch(() => orders.orders.length, () => {
  for (const o of orders.orders) {
    if (knownIds.has(o.id)) continue
    knownIds.add(o.id)
    if (o.status === 'delivered') continue
    freshIds.value = new Set(freshIds.value).add(o.id)
    setTimeout(() => {
      const next = new Set(freshIds.value); next.delete(o.id); freshIds.value = next
    }, 6000)
    toast.add(`Novo pedido ${formatOrderNumber(o.number)} — ${destinationLabel(o.destination)}`, 'info')
  }
})

// --- Disponibilidade ---
const showAvailability = ref(false)
const availSearch      = ref('')
const availProducts    = computed(() => {
  const q = availSearch.value.trim().toLowerCase()
  return catalog.activeProducts.filter((p) => !q || p.name.toLowerCase().includes(q))
})
</script>

<style lang="scss" scoped>
.kitchen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  &__filters {
    display: flex;
    gap: var(--spacing-sm);
    overflow-x: auto;
    scrollbar-width: none;
  }

  &__tabs {
    display: flex;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    @media (min-width: 900px) { display: none; }
  }

  &__board {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    @media (min-width: 900px) { grid-template-columns: repeat(3, 1fr); align-items: start; }
  }
}

.head-btn {
  @include button-reset;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  &:hover { color: var(--color-text); border-color: var(--color-primary); }
}

.legend {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    &::before { content: ''; width: 10px; height: 10px; border-radius: 3px; }
    &--ok::before   { background: var(--color-success); }
    &--warn::before { background: var(--color-warning); }
    &--late::before { background: var(--color-danger); }
  }
}

.ktab {
  flex: 1;
  @include button-reset;
  padding: 12px 4px;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  font-weight: 500;
  @include flex-center;
  gap: 6px;

  &--active { color: var(--color-text); border-bottom-color: var(--color-primary); }

  &__count {
    min-width: 22px;
    height: 20px;
    padding: 0 6px;
    border-radius: 99px;
    background: var(--color-surface-alt);
    font-size: 0.75rem;
    font-weight: 700;
    @include flex-center;
  }
}

.column {
  &--hidden-mobile { @media (max-width: 899px) { display: none; } }

  &__title {
    display: none;
    @media (min-width: 900px) {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin-bottom: var(--spacing-sm);
    }
  }

  &__count { font-family: var(--font-mono); color: var(--color-text); }
  &__list { position: relative; display: flex; flex-direction: column; gap: var(--spacing-md); }

  &__empty {
    padding: var(--spacing-xl) var(--spacing-md);
    text-align: center;
    color: var(--color-text-muted);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
  }
}

.ticket {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 4px solid var(--color-success);
  border-radius: var(--radius-lg);
  overflow: hidden;

  &--warn { border-top-color: var(--color-warning); }
  &--late { border-top-color: var(--color-danger); box-shadow: 0 0 0 1px var(--color-danger); }
  &--warn .ticket__age { background: var(--color-warning-soft); color: var(--color-warning); }
  &--late .ticket__age { background: var(--color-danger-soft); color: var(--color-danger); }
  &--fresh { animation: fresh 1s ease 3; }

  &__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-surface-alt);
  }

  &__number { font-family: var(--font-mono); font-size: 1.25rem; font-weight: 500; }

  &__who {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
    strong { font-size: 0.9375rem; color: var(--color-accent-text); }
    span { font-size: 0.75rem; color: var(--color-text-muted); @include truncate; }
  }

  &__age {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-success);
    background: var(--color-success-soft);
    flex-shrink: 0;
  }

  &__items { padding: var(--spacing-sm) var(--spacing-md); display: flex; flex-direction: column; gap: 10px; }
  &__item  { display: flex; gap: var(--spacing-md); align-items: flex-start; }
  &__item--cancelled { opacity: 0.45; .ticket__name { text-decoration: line-through; } }

  &__qty {
    min-width: 30px;
    height: 30px;
    border-radius: var(--radius-md);
    background: var(--color-primary-soft);
    color: var(--color-accent-text);
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 1.0625rem;
    @include flex-center;
  }

  &__item-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  &__name { font-size: 1.0625rem; font-weight: 600; line-height: 1.3; }
  &__station { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
  &__choices { font-size: 0.875rem; color: var(--color-text-muted); }
  &__note { font-size: 0.875rem; font-weight: 600; color: var(--color-warning); }

  &__order-note {
    margin: 0 var(--spacing-md) var(--spacing-sm);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    background: var(--color-warning-soft);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-warning);

    &--pack { background: var(--color-primary-soft); color: var(--color-accent-text); }
  }

  &__others { padding: 0 var(--spacing-md) var(--spacing-sm); font-size: 0.8125rem; color: var(--color-text-muted); }

  &__actions { display: flex; gap: var(--spacing-sm); padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md); }

  &__undo {
    @include button-reset;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 1.25rem;
    &:hover { color: var(--color-text); }
  }
}

@keyframes fresh {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50%      { box-shadow: 0 0 0 4px var(--color-primary); }
}

.ticket-move, .ticket-enter-active, .ticket-leave-active { transition: all 250ms ease; }
.ticket-enter-from, .ticket-leave-to { opacity: 0; transform: translateY(12px); }
.ticket-leave-active { position: absolute; width: 100%; }

.avail-search { margin-bottom: var(--spacing-md); }

.avail {
  display: flex;
  flex-direction: column;

  &__row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border);
  }

  &__emoji { font-size: 1.375rem; width: 28px; text-align: center; }
  &__info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  &__warn { color: var(--color-warning); font-size: 0.75rem; }
}
</style>
