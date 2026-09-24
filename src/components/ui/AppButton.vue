<template>
  <button
    :class="['btn', `btn--${variant}`, `btn--${size}`, { 'btn--full': fullWidth, 'btn--loading': loading }]"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'outline' | 'ink'
    size?: 'sm' | 'md' | 'lg' | 'xl'
    loading?: boolean
    fullWidth?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', size: 'md' }
)
</script>

<style lang="scss" scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), opacity var(--transition), transform var(--transition);
  white-space: nowrap;
  user-select: none;

  &:active:not(:disabled) { transform: scale(0.97); }

  &:disabled { opacity: 0.45; cursor: not-allowed; }

  // Sizes
  &--sm  { height: 32px; padding: 0 12px; font-size: 0.8125rem; }
  &--md  { height: 40px; padding: 0 16px; font-size: 0.9375rem; }
  &--lg  { height: 48px; padding: 0 24px; font-size: 1rem; }
  &--xl  { height: 56px; padding: 0 24px; font-size: 1.0625rem; font-weight: 600; border-radius: var(--radius-lg); }

  // Variants
  &--primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    &:hover:not(:disabled) { background: var(--color-primary-dim); }
  }
  &--ghost {
    background: transparent;
    color: var(--color-text-muted);
    &:hover:not(:disabled) { background: var(--color-surface-alt); color: var(--color-text); }
  }
  &--danger {
    background: var(--color-danger);
    color: #fff;
    &:hover:not(:disabled) { filter: brightness(0.92); }
  }
  &--success {
    background: var(--color-success);
    color: #fff;
    &:hover:not(:disabled) { filter: brightness(0.92); }
  }
  &--outline {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    &:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-accent-text); }
  }

  // Botão escuro (espresso no claro, marfim no escuro): CTA sóbrio do cliente
  &--ink {
    background: var(--color-ink);
    color: var(--color-on-ink);
    &:hover:not(:disabled) { opacity: 0.88; }
  }

  &--full { width: 100%; }

  &--loading { pointer-events: none; }
}

.btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
