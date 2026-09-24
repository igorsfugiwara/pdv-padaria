<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="modelValue" class="drawer-overlay" @mousedown.self="close" role="dialog" aria-modal="true" :aria-label="title">
        <aside :class="['drawer', `drawer--${size}`]">
          <header class="drawer__header">
            <div class="drawer__heading">
              <h2 class="drawer__title">{{ title }}</h2>
              <p v-if="subtitle" class="drawer__subtitle">{{ subtitle }}</p>
            </div>
            <slot name="header-actions" />
            <button class="drawer__close" @click="close" aria-label="Fechar">✕</button>
          </header>
          <div class="drawer__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="drawer__footer">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

// Painel lateral de detalhe (comanda, produto, insumo). No celular ocupa a tela.
const props = withDefaults(
  defineProps<{ modelValue: boolean; title: string; subtitle?: string; size?: 'md' | 'lg' }>(),
  { size: 'md' }
)
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

function close() { emit('update:modelValue', false) }
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') close() }

watch(() => props.modelValue, (val) => {
  if (val) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 90;
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: 100%;
  height: 100%;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;

  &--md { max-width: 480px; }
  &--lg { max-width: 640px; }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &__heading { flex: 1; min-width: 0; }
  &__title    { font-size: 1.125rem; font-weight: 600; }
  &__subtitle { font-size: 0.8125rem; color: var(--color-text-muted); margin-top: 2px; }

  &__close {
    @include button-reset;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    flex-shrink: 0;
    &:hover { color: var(--color-text); background: var(--color-surface-alt); }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    @include scrollbar;
  }

  &__footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg) calc(var(--spacing-md) + var(--safe-bottom));
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }
}

.drawer-enter-active, .drawer-leave-active {
  transition: opacity 180ms ease;
  .drawer { transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1); }
}
.drawer-enter-from, .drawer-leave-to {
  opacity: 0;
  .drawer { transform: translateX(40px); }
}
</style>
