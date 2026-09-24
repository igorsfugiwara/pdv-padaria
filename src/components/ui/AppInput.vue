<template>
  <div :class="['field', { 'field--error': error }]">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <input
      :id="id"
      :class="['field__input', { 'field__input--money': variant === 'money' }]"
      v-bind="$attrs"
      :value="displayValue"
      @input="onInput"
      @blur="onBlur"
      @focus="onFocus"
    />
    <span v-if="error" class="field__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { v4 as uuid } from 'uuid'

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    error?: string
    variant?: 'text' | 'money'
  }>(),
  { variant: 'text' }
)

const emit = defineEmits<{ 'update:modelValue': [v: string | number] }>()
const id   = uuid()
const raw  = ref('')

const displayValue = computed(() => {
  if (props.variant !== 'money') return props.modelValue
  const cents = typeof props.modelValue === 'number' ? props.modelValue : 0
  if (cents === 0 && raw.value === '') return ''
  return (cents / 100).toFixed(2).replace('.', ',')
})

function parseMoney(val: string): number {
  const clean = val.replace(/[^\d]/g, '')
  return parseInt(clean || '0', 10)
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  if (props.variant === 'money') {
    raw.value = target.value
    const cents = parseMoney(target.value)
    target.value = (cents / 100).toFixed(2).replace('.', ',')
    emit('update:modelValue', cents)
  } else {
    emit('update:modelValue', target.value)
  }
}

function onBlur(e: Event) {
  if (props.variant === 'money') {
    const target = e.target as HTMLInputElement
    const cents  = parseMoney(target.value)
    target.value = (cents / 100).toFixed(2).replace('.', ',')
  }
}

function onFocus(e: Event) {
  const target = e.target as HTMLElement
  setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
}
</script>

<style lang="scss" scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  &__input {
    height: 40px;
    padding: 0 var(--spacing-sm);
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    transition: border-color var(--transition);
    width: 100%;

    &:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    &--money {
      font-family: var(--font-mono);
    }

    &::placeholder { color: var(--color-text-muted); }
  }

  &--error .field__input { border-color: var(--color-danger); }

  &__error {
    font-size: 0.8125rem;
    color: var(--color-danger);
  }
}
</style>
