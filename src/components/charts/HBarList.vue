<template>
  <figure class="hbars">
    <figcaption v-if="title" class="hbars__head">
      <h3 class="hbars__title">{{ title }}</h3>
      <p v-if="subtitle" class="hbars__subtitle">{{ subtitle }}</p>
    </figcaption>
    <ul class="hbars__list">
      <li v-for="row in rows" :key="row.key" class="hbar" tabindex="0" :aria-label="`${row.label}: ${format(row.value)}`">
        <div class="hbar__top">
          <span class="hbar__label">{{ row.label }}</span>
          <span class="hbar__value">{{ format(row.value) }}</span>
          <span v-if="total > 0" class="hbar__share">{{ Math.round((row.value / total) * 100) }}%</span>
        </div>
        <div class="hbar__track">
          <div class="hbar__fill" :style="{ width: `${max ? (row.value / max) * 100 : 0}%` }" />
        </div>
      </li>
    </ul>
    <p v-if="!rows.length" class="hbars__empty">Sem dados no período.</p>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Barras horizontais de uma série: rótulo e valor em texto (nunca na cor da barra),
// participação ao lado. Funciona como tabela e como gráfico ao mesmo tempo.
const props = defineProps<{
  title?: string
  subtitle?: string
  rows: { key: string; label: string; value: number }[]
  format: (v: number) => string
}>()

const max   = computed(() => Math.max(0, ...props.rows.map((r) => r.value)))
const total = computed(() => props.rows.reduce((s, r) => s + r.value, 0))
</script>

<style lang="scss" scoped>
.hbars {
  @include card;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  &__title    { font-size: 0.9375rem; font-weight: 600; }
  &__subtitle { font-size: 0.8125rem; color: var(--color-text-muted); }
  &__list     { display: flex; flex-direction: column; gap: 12px; }
  &__empty    { font-size: 0.875rem; color: var(--color-text-muted); }
}

.hbar {
  outline: none;
  border-radius: var(--radius-sm);

  &:hover .hbar__fill, &:focus-visible .hbar__fill { background: var(--chart-bar-hover); }

  &__top {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-sm);
    font-size: 0.875rem;
    margin-bottom: 4px;
  }

  &__label { flex: 1; min-width: 0; @include truncate; }
  &__value { font-weight: 600; font-variant-numeric: tabular-nums; }
  &__share { width: 36px; text-align: right; font-size: 0.75rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }

  &__track { height: 8px; }

  &__fill {
    height: 100%;
    min-width: 2px;
    border-radius: 0 4px 4px 0;
    background: var(--chart-bar);
    transition: background var(--transition), width 300ms ease;
  }
}
</style>
