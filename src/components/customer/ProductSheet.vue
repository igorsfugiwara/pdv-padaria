<template>
  <AppSheet :model-value="!!product" @update:model-value="(v) => !v && emit('close')">
    <div v-if="product" class="product-sheet">
      <div class="product-sheet__hero" aria-hidden="true">{{ product.emoji }}</div>
      <h2 class="product-sheet__name">{{ product.name }}</h2>
      <p class="product-sheet__desc">{{ product.description }}</p>
      <span class="product-sheet__base money">{{ formatMoney(product.price) }}</span>

      <section v-for="group in product.options" :key="group.id" class="option-group">
        <header class="option-group__header">
          <div>
            <h3 class="option-group__name">{{ group.name }}</h3>
            <span class="option-group__hint">
              {{ group.max === 1 ? 'Escolha 1' : `Escolha até ${group.max}` }}
            </span>
          </div>
          <span
            v-if="group.required"
            :class="['option-group__req', { 'option-group__req--ok': (selected[group.id]?.length ?? 0) > 0 }]"
          >{{ (selected[group.id]?.length ?? 0) > 0 ? '✓' : 'Obrigatório' }}</span>
        </header>

        <label
          v-for="choice in group.choices"
          :key="choice.id"
          :class="['option', { 'option--on': isOn(group.id, choice.id), 'option--blocked': isBlocked(group, choice.id) }]"
        >
          <input
            :type="group.max === 1 ? 'radio' : 'checkbox'"
            :name="group.id"
            :checked="isOn(group.id, choice.id)"
            :disabled="isBlocked(group, choice.id)"
            class="option__input"
            @change="toggle(group, choice.id)"
          />
          <span :class="['option__mark', group.max === 1 ? 'option__mark--radio' : 'option__mark--check']" />
          <span class="option__name">{{ choice.name }}</span>
          <span v-if="choice.price" class="option__price money">+ {{ formatMoney(choice.price) }}</span>
        </label>
      </section>

      <section class="option-group">
        <header class="option-group__header">
          <div>
            <h3 class="option-group__name">Alguma observação?</h3>
            <span class="option-group__hint">Vai junto para a cozinha</span>
          </div>
        </header>
        <textarea
          v-model="note"
          class="product-sheet__note"
          rows="2"
          maxlength="140"
          placeholder="Ex.: sem sal, bem passado, pouco açúcar…"
        />
      </section>
    </div>

    <template v-if="product" #footer>
      <QtyStepper v-model="qty" />
      <AppButton size="xl" full-width :disabled="!isValid" @click="confirm">
        Adicionar · {{ formatMoney(lineTotal) }}
      </AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { OptionGroup, Product, SelectedChoice } from '@/types'
import { formatMoney } from '@/lib/format'
import AppSheet   from '@/components/ui/AppSheet.vue'
import AppButton  from '@/components/ui/AppButton.vue'
import QtyStepper from '@/components/ui/QtyStepper.vue'

const props = defineProps<{ product: Product | null }>()
const emit  = defineEmits<{
  close: []
  add:   [payload: { product: Product; qty: number; choices: SelectedChoice[]; note: string }]
}>()

const qty      = ref(1)
const note     = ref('')
const selected = ref<Record<string, string[]>>({})

// Cada abertura começa limpa, com a primeira opção dos grupos de escolha única já marcada
watch(() => props.product, (p) => {
  qty.value  = 1
  note.value = ''
  selected.value = {}
  p?.options?.forEach((g) => {
    selected.value[g.id] = g.required && g.max === 1 ? [g.choices[0].id] : []
  })
})

function isOn(groupId: string, choiceId: string): boolean {
  return selected.value[groupId]?.includes(choiceId) ?? false
}

function isBlocked(group: OptionGroup, choiceId: string): boolean {
  if (group.max === 1) return false
  const list = selected.value[group.id] ?? []
  return list.length >= group.max && !list.includes(choiceId)
}

function toggle(group: OptionGroup, choiceId: string): void {
  const list = selected.value[group.id] ?? []
  if (group.max === 1) {
    selected.value[group.id] = [choiceId]
  } else if (list.includes(choiceId)) {
    selected.value[group.id] = list.filter((id) => id !== choiceId)
  } else if (list.length < group.max) {
    selected.value[group.id] = [...list, choiceId]
  }
}

const choices = computed<SelectedChoice[]>(() => {
  const p = props.product
  if (!p?.options) return []
  return p.options.flatMap((g) =>
    (selected.value[g.id] ?? []).map((cid) => {
      const c = g.choices.find((x) => x.id === cid)!
      return { groupId: g.id, groupName: g.name, choiceId: c.id, name: c.name, price: c.price }
    })
  )
})

const isValid = computed(() =>
  (props.product?.options ?? []).every((g) => !g.required || (selected.value[g.id]?.length ?? 0) > 0)
)

const lineTotal = computed(() => {
  if (!props.product) return 0
  const unit = props.product.price + choices.value.reduce((s, c) => s + c.price, 0)
  return unit * qty.value
})

function confirm(): void {
  if (!props.product || !isValid.value) return
  emit('add', { product: props.product, qty: qty.value, choices: choices.value, note: note.value })
}
</script>

<style lang="scss" scoped>
.product-sheet {
  display: flex;
  flex-direction: column;

  &__hero {
    margin: var(--spacing-sm) calc(-1 * var(--spacing-lg)) var(--spacing-md);
    height: 180px;
    background: radial-gradient(circle at 50% 40%, #FFFFFF 0%, var(--color-surface-alt) 75%);
    border-bottom: 1px solid var(--color-border);
    font-size: 5.5rem;
    @include flex-center;
  }

  &__name { font-family: var(--font-display); font-size: 1.625rem; font-weight: 700; line-height: 1.2; }
  &__desc { color: var(--color-text-muted); margin-top: var(--spacing-xs); font-size: 0.9375rem; }
  &__base { margin-top: var(--spacing-sm); font-size: 1.0625rem; color: var(--color-accent-text); }

  &__note {
    width: 100%;
    resize: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 1rem;
    line-height: 1.4;
    &:focus { outline: none; border-color: var(--color-primary); }
  }
}

.option-group {
  margin-top: var(--spacing-lg);

  &__header {
    @include flex-between;
    margin: 0 calc(-1 * var(--spacing-lg)) var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-surface-alt);
  }

  &__name { font-size: 0.9375rem; font-weight: 600; }
  &__hint { font-size: 0.8125rem; color: var(--color-text-muted); }

  &__req {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    background: var(--color-ink);
    color: var(--color-on-ink);

    &--ok { background: var(--color-primary); color: var(--color-text-inverse); }
  }
}

.option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-height: 52px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;

  &:last-child { border-bottom: none; }
  &--blocked { opacity: 0.45; cursor: not-allowed; }

  &__input { position: absolute; opacity: 0; pointer-events: none; }

  &__mark {
    order: 3;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border: 2px solid var(--color-border);
    transition: border-color var(--transition), background var(--transition);
    @include flex-center;

    &--radio { border-radius: 50%; }
    &--check { border-radius: var(--radius-sm); }
  }

  &--on &__mark { border-color: var(--color-primary); }
  &--on &__mark--radio::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--color-primary); }
  &--on &__mark--check { background: var(--color-primary); &::after { content: '✓'; color: var(--color-text-inverse); font-size: 13px; font-weight: 700; } }
  &__input:focus-visible + &__mark { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  &__name  { flex: 1; font-size: 0.9375rem; }
  &__price { font-size: 0.875rem; color: var(--color-text-muted); }
}
</style>
