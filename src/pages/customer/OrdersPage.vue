<template>
  <div class="orders">
    <header class="page-header">
      <h1>Pedidos</h1>
      <ComandaChip />
    </header>

    <section class="tab-card">
      <div class="tab-card__row">
        <div>
          <span class="tab-card__label">Comanda {{ customer.session?.number }}<template v-if="customer.session?.customerName"> · {{ customer.session.customerName }}</template></span>
          <strong class="tab-card__total money">{{ formatMoney(total) }}</strong>
        </div>
        <span class="tab-card__count">{{ myOrders.length }} {{ myOrders.length === 1 ? 'pedido' : 'pedidos' }}</span>
      </div>
      <p class="tab-card__hint">Pague no caixa ao sair, apresentando esta comanda.</p>
    </section>

    <div v-if="!myOrders.length" class="orders__empty">
      <span aria-hidden="true">🧾</span>
      <p>Você ainda não fez nenhum pedido com esta comanda.</p>
      <AppButton size="lg" variant="ink" @click="router.push({ name: 'menu' })">Ver cardápio</AppButton>
    </div>

    <ul v-else class="orders__list">
      <li
        v-for="order in myOrders"
        :key="order.id"
        :class="['order', `order--${order.status}`, { 'order--new': order.id === highlightId }]"
      >
        <div v-if="order.status === 'ready'" class="order__ready">
          <span class="order__ready-icon" aria-hidden="true">🔔</span>
          <div v-if="order.destination.type === 'mesa'">
            <strong>Pronto! A caminho da mesa {{ order.destination.table }}</strong>
            <span>É só aguardar, já vamos levar.</span>
          </div>
          <div v-else>
            <strong>Pronto! Retire no balcão</strong>
            <span>Informe a senha {{ formatOrderNumber(order.number) }}</span>
          </div>
        </div>

        <header class="order__header">
          <div>
            <span class="order__number">Senha {{ formatOrderNumber(order.number) }}</span>
            <span class="order__time">{{ formatTime(order.createdAt) }} · {{ destinationLabel(order.destination) }}</span>
          </div>
          <span class="order__total money">{{ formatMoney(orderTotal(order)) }}</span>
        </header>

        <StatusTrack :status="order.status" />

        <ul class="order__items">
          <li v-for="item in order.items" :key="item.id" :class="['order__item', { 'order__item--cancelled': item.cancelled }]">
            <span class="order__qty">{{ item.quantity }}×</span>
            <div>
              <span>{{ item.productName }}</span>
              <span v-if="item.choices.length" class="order__detail">{{ item.choices.map((c) => c.name).join(' · ') }}</span>
              <span v-if="item.note" class="order__detail order__detail--note">“{{ item.note }}”</span>
            </div>
          </li>
        </ul>
        <p v-if="order.note" class="order__note">Obs.: {{ order.note }}</p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Order } from '@/types'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { formatMoney, formatTime, formatOrderNumber, destinationLabel } from '@/lib/format'
import { orderSubtotal } from '@/mock/build'
import ComandaChip from '@/components/customer/ComandaChip.vue'
import StatusTrack from '@/components/customer/StatusTrack.vue'
import AppButton   from '@/components/ui/AppButton.vue'

const orderStore = useOrderStore()
const customer   = useCustomerStore()
const route        = useRoute()
const router       = useRouter()

const highlightId = computed(() => route.query.novo as string | undefined)

// Prontos primeiro, depois os em andamento, retirados por último
const rank: Record<Order['status'], number> = { ready: 0, preparing: 1, received: 2, delivered: 3 }

const myOrders = computed(() =>
  customer.sessionId
    ? [...orderStore.byComanda(customer.sessionId)].sort((a, b) => rank[a.status] - rank[b.status])
    : []
)

const total = computed(() => (customer.sessionId ? orderStore.comandaSubtotal(customer.sessionId) : 0))

const orderTotal = (o: Order) => orderSubtotal(o)
</script>

<style lang="scss" scoped>
.orders {
  padding-bottom: calc(var(--bottomnav-height) + var(--safe-bottom) + var(--spacing-lg));

  &__empty {
    padding: 48px var(--spacing-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
    color: var(--color-text-muted);
    span { font-size: 2.5rem; }
    p    { margin-bottom: var(--spacing-md); }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: 0 var(--spacing-md);
  }
}

.tab-card {
  margin: 0 var(--spacing-md) var(--spacing-lg);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-ink);
  color: var(--color-on-ink);
  position: relative;
  overflow: hidden;

  // filete dourado no topo do cartão escuro
  &::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--color-primary); }

  &__row   { @include flex-between; align-items: flex-end; }
  &__label { display: block; font-size: 0.8125rem; opacity: 0.7; }
  &__total { font-size: 1.75rem; line-height: 1.2; color: var(--color-accent-text); }
  &__count { font-size: 0.8125rem; opacity: 0.7; }
  &__hint  { margin-top: var(--spacing-sm); font-size: 0.8125rem; opacity: 0.7; }
}

.order {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  overflow: hidden;

  &--ready { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
  &--delivered { opacity: 0.6; }
  &--new { animation: arrive 900ms ease; }

  &__ready {
    margin: calc(-1 * var(--spacing-md)) calc(-1 * var(--spacing-md)) 0;
    padding: var(--spacing-md);
    background: var(--color-primary);
    color: var(--color-text-inverse);
    @include flex-gap(var(--spacing-md));

    strong { display: block; font-size: 1.0625rem; }
    span   { font-size: 0.875rem; opacity: 0.9; }
  }

  &__ready-icon { font-size: 1.75rem; animation: ring 1.2s ease-in-out infinite; }

  &__header { @include flex-between; align-items: flex-start; }
  &__number { display: block; font-family: var(--font-mono); font-weight: 500; font-size: 1.0625rem; }
  &__time   { font-size: 0.8125rem; color: var(--color-text-muted); }
  &__total  { font-size: 1rem; }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: var(--spacing-sm);
    border-top: 1px dashed var(--color-border);
  }

  &__item { display: flex; gap: var(--spacing-sm); font-size: 0.9375rem; }
  &__item--cancelled { text-decoration: line-through; opacity: 0.5; }
  &__qty  { font-family: var(--font-mono); color: var(--color-accent-text); min-width: 26px; }

  &__detail {
    display: block;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    &--note { font-style: italic; }
  }

  &__note { font-size: 0.8125rem; color: var(--color-text-muted); }
}

@keyframes arrive {
  from { transform: translateY(12px); box-shadow: 0 0 0 4px var(--color-primary-soft); }
  to   { transform: none; }
}

@keyframes ring {
  0%, 60%, 100% { transform: rotate(0); }
  10%, 30%      { transform: rotate(-14deg); }
  20%, 40%      { transform: rotate(14deg); }
}
</style>
