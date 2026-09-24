<template>
  <nav class="bottom-nav" aria-label="Navegação principal">
    <RouterLink :to="{ name: 'menu' }" class="bottom-nav__item" active-class="bottom-nav__item--active">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
      </span>
      Cardápio
    </RouterLink>

    <RouterLink :to="{ name: 'cart' }" class="bottom-nav__item" active-class="bottom-nav__item--active">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
        <span v-if="cart.count" class="bottom-nav__badge">{{ cart.count }}</span>
      </span>
      Sacola
    </RouterLink>

    <RouterLink :to="{ name: 'orders' }" class="bottom-nav__item" active-class="bottom-nav__item--active">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
        <span v-if="readyCount" class="bottom-nav__badge bottom-nav__badge--ready">{{ readyCount }}</span>
      </span>
      Pedidos
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore }     from '@/stores/useCartStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCustomerStore } from '@/stores/useCustomerStore'

const cart     = useCartStore()
const orders   = useOrderStore()
const customer = useCustomerStore()

const readyCount = computed(() =>
  customer.sessionId ? orders.byComanda(customer.sessionId).filter((o) => o.status === 'ready').length : 0
)
</script>

<style lang="scss" scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: var(--shell-width);
  height: calc(var(--bottomnav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--color-border);
  display: flex;
  z-index: 40;

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    transition: color var(--transition);

    &--active { color: var(--color-accent-text); }
  }

  &__icon {
    position: relative;
    width: 24px;
    height: 24px;

    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }

  &__badge {
    position: absolute;
    top: -4px;
    right: -10px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 99px;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    font-size: 0.6875rem;
    font-weight: 700;
    @include flex-center;

    &--ready {
      background: var(--color-success);
      color: #fff;
      animation: pulse 1.4s ease-in-out infinite;
    }
  }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(62, 142, 99, 0.5); }
  50%      { box-shadow: 0 0 0 6px rgba(62, 142, 99, 0); }
}
</style>
