<template>
  <div class="toast-container" aria-live="polite" aria-label="Notificações">
    <TransitionGroup name="toast-list">
      <AppToast v-for="toast in toastStore.toasts" :key="toast.id" :toast="toast" />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/useToastStore'
import AppToast from './AppToast.vue'

const toastStore = useToastStore()
</script>

<style lang="scss" scoped>
// No celular a barra inferior ocupa o rodapé; o toast desce do topo
.toast-container {
  position: fixed;
  top: calc(var(--spacing-md) + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: min(calc(100% - 2 * var(--spacing-md)), 420px);
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  pointer-events: none;

  > * { pointer-events: auto; }
}

.toast-list-enter-active,
.toast-list-leave-active { transition: all 250ms ease; }

.toast-list-enter-from { opacity: 0; transform: translateY(-24px); }
.toast-list-leave-to   { opacity: 0; transform: translateY(-24px); }
</style>
