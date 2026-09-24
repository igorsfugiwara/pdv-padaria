<template>
  <div :class="['toast', `toast--${toast.type}`]" role="alert">
    <span class="toast__icon">{{ icons[toast.type] }}</span>
    <span class="toast__message">{{ toast.message }}</span>
    <button class="toast__close" @click="toastStore.remove(toast.id)" aria-label="Fechar">✕</button>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/useToastStore'
import type { ToastMessage } from '@/types'

defineProps<{ toast: ToastMessage }>()

const toastStore = useToastStore()
const icons: Record<ToastMessage['type'], string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}
</script>

<style lang="scss" scoped>
.toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  width: 100%;
  font-size: 0.9375rem;
  color: #F0EDE6;

  &--success { background: #1e3a2a; border-left: 3px solid var(--color-success); }
  &--error   { background: #3a1e1e; border-left: 3px solid var(--color-danger); }
  &--info    { background: #2A1C10; border-left: 3px solid var(--color-primary); }

  &__icon {
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  &__message { flex: 1; }

  &__close {
    background: none;
    border: none;
    color: rgba(240, 237, 230, 0.6);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 2px 4px;
    flex-shrink: 0;
    &:hover { color: #F0EDE6; }
  }
}
</style>
