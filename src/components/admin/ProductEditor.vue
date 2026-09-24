<template>
  <AppDrawer
    :model-value="open"
    :title="isNew ? 'Novo produto' : draft.name || 'Produto'"
    :subtitle="isNew ? 'Cadastre o item e a ficha técnica' : 'Dados do cardápio e ficha técnica'"
    size="lg"
    @update:model-value="emit('close')"
  >
    <div class="editor">
      <section class="editor__section">
        <h3 class="eyebrow">Cardápio</h3>
        <div class="form-grid">
          <div class="field span-2">
            <span class="field__label">Nome</span>
            <input v-model="draft.name" class="input" maxlength="60" />
          </div>
          <div class="field span-2">
            <span class="field__label">Descrição (aparece para o cliente)</span>
            <textarea v-model="draft.description" class="textarea" rows="2" maxlength="140" />
          </div>
          <AppInput v-model="draft.price" label="Preço de venda" variant="money" />
          <div class="field">
            <span class="field__label">Ícone (foto no cardápio real)</span>
            <input v-model="draft.emoji" class="input" maxlength="4" />
          </div>
          <div class="field">
            <span class="field__label">Categoria</span>
            <select v-model="draft.categoryId" class="select">
              <option v-for="c in catalog.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="field">
            <span class="field__label">Preparado em</span>
            <select v-model="draft.station" class="select">
              <option v-for="(label, key) in stationLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="field span-2">
            <span class="field__label">Selos (separados por vírgula)</span>
            <input v-model="tagsText" class="input" placeholder="Mais pedido, Novo, Vegano…" />
          </div>
        </div>
        <div class="editor__toggles">
          <label class="toggle">
            <button type="button" :class="['switch', { 'switch--on': draft.active }]" role="switch" :aria-checked="draft.active" @click="draft.active = !draft.active" />
            No cardápio
          </label>
          <label class="toggle">
            <button type="button" :class="['switch', { 'switch--on': draft.available }]" role="switch" :aria-checked="draft.available" @click="draft.available = !draft.available" />
            Disponível agora
          </label>
        </div>
      </section>

      <section class="editor__section">
        <div class="editor__head">
          <h3 class="eyebrow">Ficha técnica · 1 unidade</h3>
          <button class="add-line" @click="draft.recipe.push({ insumoId: catalog.insumos[0].id, qty: 0 })">+ Insumo</button>
        </div>

        <div v-if="draft.recipe.length" class="recipe">
          <div v-for="(line, i) in draft.recipe" :key="i" class="recipe__row">
            <select v-model="line.insumoId" class="select recipe__insumo" aria-label="Insumo">
              <option v-for="ins in catalog.insumos" :key="ins.id" :value="ins.id">{{ ins.name }}</option>
            </select>
            <div class="recipe__qty">
              <input
                class="input"
                type="number"
                min="0"
                step="any"
                :value="toDisplay(line)"
                aria-label="Quantidade"
                @input="(e) => fromDisplay(line, (e.target as HTMLInputElement).valueAsNumber)"
              />
              <span class="recipe__unit">{{ displayUnit(line) }}</span>
            </div>
            <span class="recipe__cost money">{{ formatMoney(lineCost(line)) }}</span>
            <button class="recipe__remove" aria-label="Remover insumo" @click="draft.recipe.splice(i, 1)">✕</button>
          </div>
        </div>
        <p v-else class="editor__empty">Sem ficha técnica: o produto não baixa estoque nem tem custo calculado.</p>

        <div class="cost">
          <div><span>Custo da receita</span><strong class="money">{{ formatMoney(cost) }}</strong></div>
          <div><span>CMV sobre o preço</span><strong>{{ draft.price ? formatPercent(cost / draft.price, 1) : '—' }}</strong></div>
          <div><span>Margem bruta</span><strong :class="marginClass">{{ draft.price ? formatPercent(margin(draft.price, cost), 1) : '—' }}</strong></div>
          <div class="cost__hint"><span>Preço para 70% de margem</span><strong class="money">{{ formatMoney(Math.ceil(cost / 0.3 / 10) * 10) }}</strong></div>
        </div>
      </section>

      <section v-if="draft.options?.length" class="editor__section">
        <h3 class="eyebrow">Adicionais e variações</h3>
        <div v-for="g in draft.options" :key="g.id" class="group">
          <p class="group__name">{{ g.name }} <small>{{ g.required ? 'obrigatório' : 'opcional' }} · até {{ g.max }}</small></p>
          <ul>
            <li v-for="c in g.choices" :key="c.id" class="group__choice">
              <span>{{ c.name }}</span>
              <span class="group__meta">
                {{ c.price ? `+ ${formatMoney(c.price)}` : 'sem acréscimo' }}
                <template v-if="c.recipe?.length"> · custo {{ formatMoney(recipeCost(c.recipe, catalog.insumoIndex)) }}</template>
              </span>
            </li>
          </ul>
        </div>
        <p class="editor__empty">A edição de adicionais entra junto com o backend; por ora eles vêm do cadastro inicial.</p>
      </section>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="emit('close')">Cancelar</AppButton>
      <AppButton :disabled="!draft.name.trim() || draft.price <= 0" @click="save">{{ isNew ? 'Cadastrar produto' : 'Salvar alterações' }}</AppButton>
    </template>
  </AppDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Product, RecipeLine } from '@/types'
import { useCatalogStore } from '@/stores/useCatalogStore'
import { useToastStore }   from '@/stores/useToastStore'
import { formatMoney, formatPercent, stationLabels } from '@/lib/format'
import { recipeCost, margin } from '@/lib/recipe'
import AppDrawer from '@/components/ui/AppDrawer.vue'
import AppInput  from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

// product = null → novo; undefined → fechado
const props = defineProps<{ product: Product | null | undefined }>()
const emit  = defineEmits<{ close: [] }>()

const catalog = useCatalogStore()
const toast   = useToastStore()

const open  = computed(() => props.product !== undefined)
const isNew = computed(() => props.product === null)

function blank(): Omit<Product, 'id'> {
  return {
    name: '', description: '', price: 0, categoryId: catalog.categories[0].id, emoji: '🍽️',
    station: 'cozinha', available: true, active: true, tags: [], recipe: [],
  }
}

const draft    = ref<Omit<Product, 'id'>>(blank())
const tagsText = ref('')

watch(() => props.product, (p) => {
  if (p === undefined) return
  draft.value    = p ? JSON.parse(JSON.stringify(p)) : blank()
  tagsText.value = (draft.value.tags ?? []).join(', ')
}, { immediate: true })

// Receita guardada na unidade do insumo; editada em g/ml para ficar natural
function displayUnit(line: RecipeLine): string {
  const u = catalog.insumoIndex.get(line.insumoId)?.unit
  return u === 'kg' ? 'g' : u === 'l' ? 'ml' : 'un'
}
function factor(line: RecipeLine): number {
  const u = catalog.insumoIndex.get(line.insumoId)?.unit
  return u === 'kg' || u === 'l' ? 1000 : 1
}
function toDisplay(line: RecipeLine): number {
  return Math.round(line.qty * factor(line) * 100) / 100
}
function fromDisplay(line: RecipeLine, v: number) {
  line.qty = Number.isFinite(v) ? v / factor(line) : 0
}

const lineCost = (line: RecipeLine) => recipeCost([line], catalog.insumoIndex)
const cost     = computed(() => recipeCost(draft.value.recipe, catalog.insumoIndex))

const marginClass = computed(() => {
  const m = margin(draft.value.price, cost.value)
  return m >= 0.65 ? 'is-ok' : m >= 0.5 ? 'is-warn' : 'is-bad'
})

function save() {
  const data = {
    ...draft.value,
    name: draft.value.name.trim(),
    tags: tagsText.value.split(',').map((t) => t.trim()).filter(Boolean),
    recipe: draft.value.recipe.filter((l) => l.qty > 0),
  }
  if (props.product) {
    catalog.updateProduct(props.product.id, data)
    toast.add(`${data.name} atualizado.`, 'success')
  } else {
    catalog.addProduct(data)
    toast.add(`${data.name} cadastrado no cardápio.`, 'success')
  }
  emit('close')
}
</script>

<style lang="scss" scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);

  &__section { display: flex; flex-direction: column; gap: var(--spacing-md); }
  &__head { @include flex-between; }
  &__toggles { display: flex; flex-wrap: wrap; gap: var(--spacing-lg); }
  &__empty { font-size: 0.8125rem; color: var(--color-text-muted); }
}

.eyebrow { color: var(--color-accent-text); }

.toggle { display: inline-flex; align-items: center; gap: var(--spacing-sm); font-size: 0.9375rem; }

.add-line {
  @include button-reset;
  font-size: 0.8125rem;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
  &:hover { border-color: var(--color-primary); color: var(--color-accent-text); }
}

.recipe {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &__row {
    display: grid;
    grid-template-columns: 1fr 130px 80px 28px;
    gap: var(--spacing-sm);
    align-items: center;
    @media (max-width: 599px) { grid-template-columns: 1fr 110px 28px; .recipe__cost { display: none; } }
  }

  &__qty { position: relative; .input { padding-right: 34px; } }
  &__unit { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.8125rem; color: var(--color-text-muted); pointer-events: none; }
  &__cost { text-align: right; font-size: 0.875rem; }

  &__remove {
    @include button-reset;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    height: 28px;
    border-radius: var(--radius-sm);
    &:hover { color: var(--color-danger); background: var(--color-danger-soft); }
  }
}

.cost {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-border);
  border: 1px solid var(--color-border);

  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-surface-alt);
    span { font-size: 0.75rem; color: var(--color-text-muted); }
    strong { font-size: 1.0625rem; }
  }
}

.is-ok   { color: var(--color-success); }
.is-warn { color: var(--color-warning); }
.is-bad  { color: var(--color-danger); }

.group {
  &__name { font-weight: 600; font-size: 0.9375rem; small { font-weight: 400; color: var(--color-text-muted); font-size: 0.75rem; } }
  &__choice {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.875rem;
  }
  &__meta { color: var(--color-text-muted); font-size: 0.8125rem; text-align: right; }
}
</style>
