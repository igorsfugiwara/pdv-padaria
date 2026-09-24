<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Cardápio</h1>
        <p class="page__subtitle">{{ catalog.activeProducts.length }} produtos no cardápio · custo e margem pela ficha técnica</p>
      </div>
      <div class="page__actions">
        <AppButton v-if="staff.isAdmin" @click="editing = null">+ Novo produto</AppButton>
      </div>
    </header>

    <div class="tiles">
      <StatTile label="Margem média do cardápio" :value="formatPercent(avgMargin)" hint="Configuração padrão de cada item" />
      <StatTile label="Esgotados agora" :value="String(soldOut.length)" :hint="soldOut.map((p) => p.name).slice(0, 3).join(', ') || 'Nenhum'" :hint-tone="soldOut.length ? 'warning' : 'success'" />
      <StatTile label="Margem abaixo de 50%" :value="String(lowMargin.length)" :hint="lowMargin.map((p) => p.name).slice(0, 3).join(', ') || 'Nenhum'" :hint-tone="lowMargin.length ? 'danger' : 'success'" />
    </div>

    <div class="toolbar">
      <input v-model="search" class="input toolbar__search" placeholder="Buscar produto" aria-label="Buscar produto" />
      <div class="toolbar__chips">
        <button :class="['chip', { 'chip--active': !category }]" @click="category = ''">Todos</button>
        <button v-for="c in catalog.categories" :key="c.id" :class="['chip', { 'chip--active': category === c.id }]" @click="category = c.id">{{ c.name }}</button>
      </div>
    </div>

    <section class="panel">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Preparo</th>
              <th class="num">Preço</th>
              <th class="num">Custo</th>
              <th class="num">Margem</th>
              <th>Disponível</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" :class="['is-clickable', { 'is-muted': !p.active }]" @click="editing = p">
              <td data-label="Produto">
                <span class="prod">
                  <span class="prod__emoji">{{ p.emoji }}</span>
                  <span>
                    {{ p.name }}
                    <small v-if="!p.active" class="prod__off">fora do cardápio</small>
                    <small v-else-if="catalog.missingInsumo(p)" class="prod__warn">sem {{ catalog.missingInsumo(p)!.name.toLowerCase() }}</small>
                  </span>
                </span>
              </td>
              <td data-label="Categoria">{{ categoryName(p.categoryId) }}</td>
              <td data-label="Preparo">{{ stationLabels[p.station] }}</td>
              <td data-label="Preço" class="num">{{ formatMoney(p.price) }}</td>
              <td data-label="Custo" class="num">{{ p.recipe.length ? formatMoney(catalog.baseCost(p)) : '—' }}</td>
              <td data-label="Margem" :class="['num', marginClass(p)]">{{ p.recipe.length ? formatPercent(margin(p.price, catalog.baseCost(p))) : '—' }}</td>
              <td data-label="Disponível" @click.stop>
                <button
                  :class="['switch', { 'switch--on': p.available }]"
                  role="switch"
                  :aria-checked="p.available"
                  :aria-label="`${p.name} disponível`"
                  @click="catalog.toggleAvailable(p.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="panel__empty">Nenhum produto encontrado.</p>
    </section>
  </div>

  <ProductEditor :product="editing" @close="editing = undefined" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Product } from '@/types'
import { useCatalogStore } from '@/stores/useCatalogStore'
import { useStaffStore }   from '@/stores/useStaffStore'
import { formatMoney, formatPercent, stationLabels } from '@/lib/format'
import { margin } from '@/lib/recipe'
import AppButton     from '@/components/ui/AppButton.vue'
import StatTile      from '@/components/ui/StatTile.vue'
import ProductEditor from '@/components/admin/ProductEditor.vue'

const catalog = useCatalogStore()
const staff   = useStaffStore()

const search   = ref('')
const category = ref('')
// undefined = fechado, null = novo produto
const editing  = ref<Product | null | undefined>(undefined)

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return catalog.products
    .filter((p) => (!category.value || p.categoryId === category.value) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.active) - Number(a.active))
})

const categoryName = (id: string) => catalog.categories.find((c) => c.id === id)?.name ?? id

const withRecipe = computed(() => catalog.activeProducts.filter((p) => p.recipe.length))
const avgMargin  = computed(() => {
  const list = withRecipe.value
  return list.length ? list.reduce((s, p) => s + margin(p.price, catalog.baseCost(p)), 0) / list.length : 0
})
const soldOut   = computed(() => catalog.activeProducts.filter((p) => !catalog.isOrderable(p)))
const lowMargin = computed(() => withRecipe.value.filter((p) => margin(p.price, catalog.baseCost(p)) < 0.5))

function marginClass(p: Product): string {
  if (!p.recipe.length) return ''
  const m = margin(p.price, catalog.baseCost(p))
  return m >= 0.65 ? 'is-ok' : m >= 0.5 ? 'is-warn' : 'is-bad'
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  &__search { max-width: 320px; }
  &__chips { display: flex; gap: var(--spacing-sm); overflow-x: auto; scrollbar-width: none; }
}

.prod {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  small { display: block; font-size: 0.75rem; }
  &__emoji { font-size: 1.25rem; }
  &__off  { color: var(--color-text-muted); }
  &__warn { color: var(--color-warning); }
}

.is-ok   { color: var(--color-success); }
.is-warn { color: var(--color-warning); }
.is-bad  { color: var(--color-danger); }
</style>
