<template>
  <section class="dest">
    <h2 class="dest__title">Onde você está?</h2>
    <p class="dest__hint">Assim a equipe leva o pedido até você.</p>

    <div class="dest__options" role="radiogroup" aria-label="Local de entrega">
      <button
        v-for="opt in options"
        :key="opt.type"
        role="radio"
        :aria-checked="modelValue?.type === opt.type"
        :class="['dest-opt', { 'dest-opt--on': modelValue?.type === opt.type }]"
        @click="choose(opt.type)"
      >
        <span class="dest-opt__icon" aria-hidden="true">{{ opt.icon }}</span>
        <span class="dest-opt__label">{{ opt.type === 'mesa' && modelValue?.type === 'mesa' ? `Mesa ${modelValue.table}` : opt.label }}</span>
        <span class="dest-opt__sub">{{ opt.sub }}</span>
      </button>
    </div>
  </section>

  <AppSheet v-model="showTables" title="Qual é a sua mesa?">
    <p class="tables-hint">O número fica na plaquinha sobre a mesa.</p>
    <div class="tables">
      <button
        v-for="n in tables"
        :key="n"
        :class="['table-btn', { 'table-btn--on': modelValue?.type === 'mesa' && modelValue.table === n }]"
        @click="pickTable(n)"
      >{{ n }}</button>
    </div>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Destination } from '@/types'
import AppSheet from '@/components/ui/AppSheet.vue'

defineProps<{ modelValue: Destination | null; tables: number }>()
const emit  = defineEmits<{ 'update:modelValue': [d: Destination] }>()

const options = [
  { type: 'mesa',   icon: '🪑', label: 'Na mesa',     sub: 'Levamos até você' },
  { type: 'balcao', icon: '🛎️', label: 'No balcão',   sub: 'Chamamos pela senha' },
  { type: 'viagem', icon: '🥡', label: 'Para viagem', sub: 'Embalado para levar' },
] as const

const showTables = ref(false)

function choose(type: Destination['type']) {
  if (type === 'mesa') { showTables.value = true; return }
  emit('update:modelValue', { type })
}

function pickTable(n: number) {
  emit('update:modelValue', { type: 'mesa', table: n })
  showTables.value = false
}

</script>

<style lang="scss" scoped>
.dest {
  &__title { font-family: var(--font-display); font-size: 1.25rem; }
  &__hint  { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: var(--spacing-md); }

  &__options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }
}

.dest-opt {
  @include button-reset;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--spacing-md) var(--spacing-xs);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  text-align: center;
  transition: all var(--transition);

  &--on {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  &__icon  { font-size: 1.5rem; margin-bottom: 2px; }
  &__label { font-size: 0.875rem; font-weight: 600; }
  &__sub   { font-size: 0.6875rem; color: var(--color-text-muted); line-height: 1.3; }
}

.tables-hint { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: var(--spacing-md); }

.tables {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
}

.table-btn {
  @include button-reset;
  height: 56px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 1.125rem;
  transition: all var(--transition);

  &:hover { border-color: var(--color-primary); }
  &--on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-text-inverse); }
}
</style>
