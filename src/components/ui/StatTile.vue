<template>
  <div :class="['stat', { 'stat--hero': hero }]">
    <span class="stat__label">{{ label }}</span>
    <span class="stat__value">{{ value }}</span>
    <span v-if="hint" :class="['stat__hint', hintTone && `stat__hint--${hintTone}`]">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string
  hint?: string
  hintTone?: 'success' | 'warning' | 'danger'
  hero?: boolean
}>()
</script>

<style lang="scss" scoped>
.stat {
  @include card;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  &__label { font-size: 0.8125rem; color: var(--color-text-muted); }

  &__value {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.01em;
    @include truncate;
  }

  // Número principal da tela: o dobro da largura para nunca truncar
  &--hero { flex: 2 1 240px !important; }
  &--hero &__value { font-size: 2.25rem; }

  &__hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    &--success { color: var(--color-success); }
    &--warning { color: var(--color-warning); }
    &--danger  { color: var(--color-danger); }
  }
}
</style>
