<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @mousedown.self="close" role="dialog" aria-modal="true" :aria-label="title">
        <div :class="['modal', `modal--${size}`]" ref="modalEl">
          <div class="modal__header">
            <h2 class="modal__title">{{ title }}</h2>
            <button class="modal__close" @click="close" aria-label="Fechar">✕</button>
          </div>
          <div class="modal__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' }
)

const emit    = defineEmits<{ 'update:modelValue': [v: boolean] }>()
const modalEl = ref<HTMLElement | null>(null)

function close() { emit('update:modelValue', false) }

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

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
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--spacing-md);

  // No celular o modal ocupa a tela toda, com rodapé fixo
  @media (max-width: 599px) {
    padding: 0;
    align-items: stretch;
  }
}

.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;

  @media (max-width: 599px) {
    max-height: none;
    border-radius: 0;
    border: none;
  }

  &--sm { max-width: 400px; }
  &--md { max-width: 560px; }
  &--lg { max-width: 720px; }
  &--xl { max-width: 960px; }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &__title {
    font-size: 1.125rem;
    font-weight: 600;
  }

  &__close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: color var(--transition), background var(--transition);

    &:hover { color: var(--color-text); background: var(--color-surface-alt); }
  }

  &__body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;

    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  &__footer {
    padding: var(--spacing-md) var(--spacing-lg) calc(var(--spacing-md) + var(--safe-bottom));
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    justify-content: flex-end;
    flex-shrink: 0;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 150ms ease;

  .modal { transition: transform 150ms ease; }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  .modal { transform: translateY(-12px); }
}
</style>
