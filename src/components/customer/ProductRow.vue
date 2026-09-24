<template>
  <button
    :class="['product-row', { 'product-row--off': !orderable }]"
    :disabled="!orderable"
    @click="emit('select', product)"
  >
    <div class="product-row__info">
      <div class="product-row__top">
        <span class="product-row__name">{{ product.name }}</span>
        <span v-for="tag in product.tags" :key="tag" class="product-row__tag">{{ tag }}</span>
      </div>
      <span class="product-row__desc">{{ product.description }}</span>
      <span v-if="!orderable" class="product-row__soldout">Esgotado</span>
      <span v-else class="product-row__price">
        <small v-if="hasExtras">a partir de</small>
        <span class="money">{{ formatMoney(product.price) }}</span>
      </span>
    </div>
    <div class="product-row__media">
      <span class="product-row__emoji" aria-hidden="true">{{ product.emoji }}</span>
      <span v-if="inCart" class="product-row__incart">{{ inCart }}</span>
      <span v-else-if="orderable" class="product-row__add" aria-hidden="true">+</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'
import { formatMoney } from '@/lib/format'

const props = defineProps<{ product: Product; inCart: number; orderable: boolean }>()
const hasExtras = computed(() => props.product.options?.some((g) => g.choices.some((c) => c.price > 0)) ?? false)
const emit = defineEmits<{ select: [p: Product] }>()
</script>

<style lang="scss" scoped>
.product-row {
  @include button-reset;
  width: 100%;
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition);

  &:active:not(:disabled) { background: var(--color-surface-alt); }
  &--off { cursor: not-allowed; }
  &--off &__info, &--off &__emoji { opacity: 0.45; }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  &__name { font-family: var(--font-display); font-weight: 700; font-size: 1.0625rem; line-height: 1.25; }

  &__tag {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 99px;
    background: var(--color-primary-soft);
    color: var(--color-accent-text);
    letter-spacing: 0.04em;
  }

  &__desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__price {
    margin-top: 2px;
    font-size: 0.9375rem;
    small { font-size: 0.75rem; color: var(--color-text-muted); margin-right: 4px; }
  }

  &__soldout { margin-top: 2px; color: var(--color-danger); font-weight: 600; font-size: 0.8125rem; }

  &__media {
    position: relative;
    flex-shrink: 0;
    width: 88px;
    height: 88px;
    border-radius: var(--radius-lg);
    background: radial-gradient(circle at 30% 25%, #FFFFFF 0%, var(--color-surface-alt) 70%);
    border: 1px solid var(--color-border);
    @include flex-center;
  }

  &__emoji { font-size: 2.75rem; line-height: 1; }

  &__add, &__incart {
    position: absolute;
    right: -6px;
    bottom: -6px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    @include flex-center;
    box-shadow: var(--shadow-md);
    font-weight: 600;
  }

  &__add {
    background: var(--color-surface);
    color: var(--color-accent-text);
    font-size: 1.375rem;
    border: 1px solid var(--color-primary);
  }

  &__incart {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }
}
</style>
