<template>
  <figure class="chart">
    <figcaption class="chart__head">
      <div>
        <h3 class="chart__title">{{ title }}</h3>
        <p v-if="subtitle" class="chart__subtitle">{{ subtitle }}</p>
      </div>
      <button class="chart__toggle" @click="showTable = !showTable">{{ showTable ? 'Ver gráfico' : 'Ver tabela' }}</button>
    </figcaption>

    <table v-if="showTable" class="chart__table">
      <thead><tr><th>{{ labelHeader }}</th><th class="num">{{ valueHeader }}</th></tr></thead>
      <tbody>
        <tr v-for="p in points" :key="p.key"><td>{{ p.label }}</td><td class="num">{{ format(p.value) }}</td></tr>
      </tbody>
    </table>

    <div v-else class="plot" :style="{ height: `${height}px` }" @pointerleave="hover = null">
      <!-- Grade e eixo Y -->
      <div class="plot__grid" aria-hidden="true">
        <div v-for="t in ticks" :key="t" class="plot__tick" :style="{ bottom: `${(t / scaleMax) * 100}%` }">
          <span class="plot__tick-label">{{ formatTick(t) }}</span>
        </div>
      </div>

      <!-- Barras: a faixa inteira é a área de hover/foco -->
      <div class="plot__bands">
        <div
          v-for="(p, i) in points"
          :key="p.key"
          class="band"
          tabindex="0"
          role="img"
          :aria-label="`${p.label}: ${format(p.value)}`"
          @pointerenter="hover = i"
          @focus="hover = i"
          @blur="hover = null"
        >
          <span
            v-if="i === maxIndex && p.value > 0 && hover === null"
            class="band__label"
            :style="{ bottom: `calc(${(p.value / scaleMax) * 100}% + 4px)` }"
          >{{ formatTick(p.value) }}</span>
          <div
            :class="['band__bar', { 'band__bar--hover': hover === i }]"
            :style="{ height: `${(p.value / scaleMax) * 100}%` }"
          />
          <span v-if="showLabel(i)" class="band__x">{{ p.label }}</span>
        </div>
      </div>

      <div
        v-if="hover !== null"
        class="tooltip"
        :style="{ left: `${((hover + 0.5) / points.length) * 100}%` }"
      >
        <strong class="tooltip__value">{{ format(points[hover].value) }}</strong>
        <span class="tooltip__label">{{ points[hover].label }}</span>
      </div>
    </div>
  </figure>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

export interface ChartPoint { key: string; label: string; value: number }

// Colunas de uma série só (sem legenda: o título diz o que é).
// Marcas finas (≤ 24px), topo arredondado 4px, grade hairline, rótulo só no pico.
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  points: ChartPoint[]
  format: (v: number) => string
  formatTick?: (v: number) => string
  height?: number
  labelHeader?: string
  valueHeader?: string
}>(), { height: 220, labelHeader: 'Período', valueHeader: 'Valor' })

const hover     = ref<number | null>(null)
const showTable = ref(false)

const max = computed(() => Math.max(0, ...props.points.map((p) => p.value)))
const maxIndex = computed(() => props.points.findIndex((p) => p.value === max.value))

// Escala "redonda": 1, 2, 2.5 ou 5 × 10^n
const step = computed(() => {
  if (max.value <= 0) return 1
  const raw  = max.value / 4
  const pow  = 10 ** Math.floor(Math.log10(raw))
  const nice = [1, 2, 2.5, 5, 10].find((m) => m * pow >= raw)!
  return nice * pow
})
const scaleMax = computed(() => Math.max(step.value * Math.ceil(max.value / step.value), step.value))
const ticks    = computed(() => Array.from({ length: Math.round(scaleMax.value / step.value) + 1 }, (_, i) => i * step.value))

const formatTick = (v: number) => (props.formatTick ?? props.format)(v)

// Muitos pontos (30 dias): rótulo do eixo X a cada n
function showLabel(i: number): boolean {
  const n = props.points.length
  const every = n > 20 ? 5 : n > 12 ? 2 : 1
  return i % every === 0 || i === n - 1
}
</script>

<style lang="scss" scoped>
.chart {
  @include card;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  &__head { @include flex-between; align-items: flex-start; gap: var(--spacing-md); }
  &__title { font-size: 0.9375rem; font-weight: 600; }
  &__subtitle { font-size: 0.8125rem; color: var(--color-text-muted); }

  &__toggle {
    @include button-reset;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    &:hover { color: var(--color-text); background: var(--color-surface-alt); }
  }

  &__table {
    font-size: 0.875rem;
    th { text-align: left; color: var(--color-text-muted); font-weight: 500; padding: 6px 0; border-bottom: 1px solid var(--color-border); }
    td { padding: 6px 0; border-bottom: 1px solid var(--color-border); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
  }
}

.plot {
  position: relative;
  margin: 0 0 22px 52px;

  &__grid { position: absolute; inset: 0; pointer-events: none; }

  &__tick {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--chart-grid);
  }

  &__tick-label {
    position: absolute;
    right: calc(100% + 8px);
    top: -8px;
    font-size: 0.6875rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__bands {
    position: absolute;
    inset: 0;
    display: flex;
  }
}

.band {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  outline: none;
  cursor: default;

  &:focus-visible { background: var(--color-primary-soft); }

  &__bar {
    width: min(24px, 70%);
    min-height: 0;
    background: var(--chart-bar);
    border-radius: 4px 4px 0 0;
    transition: background var(--transition);

    &--hover { background: var(--chart-bar-hover); }
  }

  &__label {
    position: absolute;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }

  &__x {
    position: absolute;
    top: calc(100% + 6px);
    font-size: 0.6875rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
}

.tooltip {
  position: absolute;
  top: 0;
  transform: translate(-50%, -8px);
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;

  &__value { font-size: 0.875rem; color: var(--color-text); }
  &__label { font-size: 0.75rem; color: var(--color-text-muted); }
}
</style>
