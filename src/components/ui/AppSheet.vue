<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="sheet-overlay" @mousedown.self="close" role="dialog" aria-modal="true" :aria-label="title">
        <div class="sheet">
          <div class="sheet__grip" aria-hidden="true" />
          <div v-if="title" class="sheet__header">
            <h2 class="sheet__title">{{ title }}</h2>
            <button class="sheet__close" @click="close" aria-label="Fechar">✕</button>
          </div>
          <button v-else class="sheet__close sheet__close--floating" @click="close" aria-label="Fechar">✕</button>
          <div class="sheet__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="sheet__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

// Bottom sheet — o equivalente mobile do AppModal do Casa Ó
const props = defineProps<{
  modelValue: boolean
  title?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

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
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 12, 4, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.sheet {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 92dvh;
  width: 100%;
  max-width: var(--shell-width);

  &__grip {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--color-border);
    margin: var(--spacing-sm) auto 0;
    flex-shrink: 0;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) var(--spacing-lg);
    flex-shrink: 0;
  }

  &__title { font-size: 1.125rem; font-weight: 600; }

  &__close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    transition: color var(--transition), background var(--transition);

    &:hover { color: var(--color-text); background: var(--color-surface-alt); }

    &--floating {
      position: absolute;
      top: var(--spacing-sm);
      right: var(--spacing-sm);
      z-index: 1;
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
  }

  &__body {
    padding: 0 var(--spacing-lg) var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
    overscroll-behavior: contain;
    @include scrollbar;
  }

  &__footer {
    padding: var(--spacing-md) var(--spacing-lg) calc(var(--spacing-md) + var(--safe-bottom));
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 200ms ease;
  .sheet { transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1); }
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  .sheet { transform: translateY(100%); }
}
</style>
