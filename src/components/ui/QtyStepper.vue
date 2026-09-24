<template>
  <div :class="['stepper', `stepper--${size}`]">
    <button
      type="button"
      class="stepper__btn"
      :aria-label="modelValue <= min && removable ? 'Remover' : 'Diminuir'"
      :disabled="modelValue <= min && !removable"
      @click="emit('update:modelValue', modelValue - 1)"
    >{{ modelValue <= min && removable ? '🗑' : '−' }}</button>
    <span class="stepper__value" aria-live="polite">{{ modelValue }}</span>
    <button
      type="button"
      class="stepper__btn"
      aria-label="Aumentar"
      :disabled="modelValue >= max"
      @click="emit('update:modelValue', modelValue + 1)"
    >+</button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    removable?: boolean   // no mínimo, o "−" vira lixeira e emite min - 1
    size?: 'sm' | 'md'
  }>(),
  { min: 1, max: 99, removable: false, size: 'md' }
)

const emit = defineEmits<{ 'update:modelValue': [v: number] }>()
</script>

<style lang="scss" scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 99px;
  background: var(--color-surface);

  &__btn {
    @include button-reset;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-accent-text);
    font-size: 1.25rem;
    line-height: 1;
    border-radius: 50%;
    transition: background var(--transition);

    &:hover:not(:disabled) { background: var(--color-primary-soft); }
    &:disabled { color: var(--color-border); cursor: not-allowed; }
  }

  &__value {
    font-family: var(--font-mono);
    font-weight: 500;
    text-align: center;
  }

  &--md &__btn   { width: 44px; height: 44px; }
  &--md &__value { min-width: 28px; font-size: 1.0625rem; }
  &--sm &__btn   { width: 34px; height: 34px; font-size: 1.0625rem; }
  &--sm &__value { min-width: 22px; font-size: 0.9375rem; }
}
</style>
