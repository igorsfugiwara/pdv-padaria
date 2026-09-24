<template>
  <AppModal :modelValue="modelValue" @update:modelValue="emit('cancel')" :title="title" size="sm">
    <p class="confirm__message">{{ message }}</p>
    <template #footer>
      <AppButton variant="ghost" @click="emit('cancel')">Cancelar</AppButton>
      <AppButton :variant="variant" @click="emit('confirm')">{{ confirmLabel }}</AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'

withDefaults(
  defineProps<{
    modelValue: boolean
    message: string
    title?: string
    confirmLabel?: string
    variant?: 'danger' | 'primary'
  }>(),
  { title: 'Confirmar ação', confirmLabel: 'Confirmar', variant: 'danger' }
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<style lang="scss" scoped>
.confirm__message {
  color: var(--color-text);
  line-height: 1.6;
}
</style>
