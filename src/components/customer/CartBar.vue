<template>
  <Transition name="cart-bar">
    <RouterLink v-if="cartStore.count" :to="{ name: 'cart' }" class="cart-bar">
      <span class="cart-bar__count">{{ cartStore.count }}</span>
      <span class="cart-bar__label">Ver sacola</span>
      <span class="cart-bar__total money">{{ formatMoney(cartStore.total) }}</span>
    </RouterLink>
  </Transition>
</template>

<script setup lang="ts">
import { useCartStore } from '@/stores/useCartStore'
import { formatMoney } from '@/lib/format'

const cartStore = useCartStore()
</script>

<style lang="scss" scoped>
.cart-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--bottomnav-height) + var(--safe-bottom) + var(--spacing-sm));
  width: calc(min(100%, var(--shell-width)) - 2 * var(--spacing-md));
  height: 56px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-ink);
  color: var(--color-on-ink);
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  z-index: 30;
  font-weight: 600;

  &__count {
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: var(--color-text-inverse);
    font-family: var(--font-mono);
    @include flex-center;
  }

  &__label { flex: 1; }
  &__total { font-size: 1.0625rem; }
}

.cart-bar-enter-active, .cart-bar-leave-active { transition: all 200ms ease; }
.cart-bar-enter-from, .cart-bar-leave-to { opacity: 0; transform: translate(-50%, 16px); }
</style>
