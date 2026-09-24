<template>
  <ol class="track" :aria-label="`Situação: ${labels[status]}`">
    <li
      v-for="(s, i) in statusFlow"
      :key="s"
      :class="['track__step', { 'track__step--done': i < current, 'track__step--current': i === current }]"
    >
      <span class="track__dot" />
      <span class="track__label">{{ labels[s] }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '@/types'
import { statusFlow } from '@/stores/useOrderStore'

const props = defineProps<{ status: OrderStatus }>()

const labels: Record<OrderStatus, string> = {
  received:  'Recebido',
  preparing: 'Preparando',
  ready:     'Pronto',
  delivered: 'Entregue',
}

const current = computed(() => statusFlow.indexOf(props.status))
</script>

<style lang="scss" scoped>
.track {
  display: flex;

  &__step {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 0.6875rem;
    color: var(--color-text-muted);

    &:not(:first-child)::before {
      content: '';
      position: absolute;
      top: 6px;
      right: 50%;
      width: 100%;
      height: 2px;
      background: var(--color-border);
    }

    &--done:not(:first-child)::before,
    &--current:not(:first-child)::before { background: var(--color-primary); }
  }

  &__dot {
    position: relative;
    z-index: 1;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
  }

  &__step--done &__dot { background: var(--color-primary); border-color: var(--color-primary); }
  &__step--current &__dot { border-color: var(--color-primary); box-shadow: 0 0 0 4px var(--color-primary-soft); }
  &__step--current &__label { color: var(--color-text); font-weight: 600; }
}
</style>
