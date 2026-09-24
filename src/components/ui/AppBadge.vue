<template>
  <span :class="['badge', `badge--${tone}`]"><slot /></span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: 'gold' | 'success' | 'warning' | 'danger' | 'muted' }>(),
  { tone: 'muted' }
)
</script>

<style lang="scss" scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;

  &--gold    { background: var(--color-primary-soft); color: var(--color-accent-text); }
  &--success { background: var(--color-success-soft); color: var(--color-success); }
  &--warning { background: var(--color-warning-soft); color: var(--color-warning); }
  &--danger  { background: var(--color-danger-soft);  color: var(--color-danger); }
  &--muted   { background: var(--color-surface-alt);  color: var(--color-text-muted); }
}
</style>
