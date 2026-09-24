<template>
  <div class="menu">
    <header class="menu__header">
      <div class="menu__title-row">
        <div>
          <p class="menu__hello">{{ greeting }}</p>
          <h1 class="menu__title">{{ tenant.name }}</h1>
        </div>
        <ComandaChip />
      </div>

      <div class="menu__search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input v-model="search" type="search" placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" />
      </div>

      <nav v-if="!search" ref="chipsEl" class="menu__chips" aria-label="Categorias">
        <button
          v-for="c in visibleCategories"
          :key="c.id"
          :data-cat="c.id"
          :class="['chip', { 'chip--active': activeCategory === c.id }]"
          @click="scrollTo(c.id)"
        >{{ c.name }}</button>
      </nav>
    </header>

    <main class="menu__list">
      <template v-if="search">
        <p class="menu__results">{{ searchResults.length }} {{ searchResults.length === 1 ? 'resultado' : 'resultados' }} para “{{ search }}”</p>
        <ProductRow
          v-for="p in searchResults"
          :key="p.id"
          :product="p"
          :in-cart="qtyInCart(p.id)"
          :orderable="catalog.isOrderable(p)"
          @select="open"
        />
        <div v-if="!searchResults.length" class="menu__empty">
          <span aria-hidden="true">🔎</span>
          <p>Nada encontrado. Tente outro nome.</p>
        </div>
      </template>

      <template v-else>
        <section
          v-for="c in visibleCategories"
          :key="c.id"
          :id="`cat-${c.id}`"
          :data-cat="c.id"
          class="menu__section"
        >
          <h2 class="menu__section-title">{{ c.name }}</h2>
          <ProductRow
            v-for="p in byCategory(c.id)"
            :key="p.id"
            :product="p"
            :in-cart="qtyInCart(p.id)"
            :orderable="catalog.isOrderable(p)"
            @select="open"
          />
        </section>
      </template>
    </main>

    <CartBar />
    <ProductSheet :product="selected" @close="selected = null" @add="onAdd" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { Product, SelectedChoice } from '@/types'
import { useCartStore }     from '@/stores/useCartStore'
import { useToastStore }    from '@/stores/useToastStore'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import ComandaChip  from '@/components/customer/ComandaChip.vue'
import ProductRow   from '@/components/customer/ProductRow.vue'
import ProductSheet from '@/components/customer/ProductSheet.vue'
import CartBar      from '@/components/customer/CartBar.vue'

const cartStore  = useCartStore()
const toastStore = useToastStore()
const catalog    = useCatalogStore()
const customer   = useCustomerStore()
const tenant     = useSettingsStore().tenant

const products = computed(() => catalog.activeProducts)

const greeting = computed(() => {
  const h = new Date().getHours()
  const hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const name  = customer.session?.customerName
  return name ? `${hello}, ${name}` : hello
})

// --- Busca ---
const search = ref('')

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const searchResults = computed(() => {
  const q = normalize(search.value.trim())
  if (!q) return []
  return products.value.filter((p) => normalize(`${p.name} ${p.description}`).includes(q))
})

// --- Categorias ---
const visibleCategories = computed(() => catalog.categories.filter((c) => products.value.some((p) => p.categoryId === c.id)))

function byCategory(id: string): Product[] {
  // Esgotados vão para o fim da seção
  return products.value
    .filter((p) => p.categoryId === id)
    .sort((a, b) => Number(catalog.isOrderable(b)) - Number(catalog.isOrderable(a)))
}

const activeCategory = ref(visibleCategories.value[0]?.id ?? '')
const chipsEl        = ref<HTMLElement | null>(null)
let   observer: IntersectionObserver | null = null
let   scrollingByClick = false

function scrollTo(id: string): void {
  const el = document.getElementById(`cat-${id}`)
  if (!el) return
  activeCategory.value = id
  scrollingByClick = true
  const headerH = document.querySelector('.menu__header')?.getBoundingClientRect().height ?? 0
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH + 1, behavior: 'smooth' })
  setTimeout(() => { scrollingByClick = false }, 600)
  centerChip(id)
}

function centerChip(id: string): void {
  const chip = chipsEl.value?.querySelector<HTMLElement>(`[data-cat="${id}"]`)
  chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

// Destaca a categoria visível enquanto o cliente rola a lista
onMounted(async () => {
  await nextTick()
  observer = new IntersectionObserver((entries) => {
    if (scrollingByClick) return
    const visible = entries.filter((e) => e.isIntersecting)
    if (!visible.length) return
    const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
    const id  = (top.target as HTMLElement).dataset.cat
    if (id && id !== activeCategory.value) {
      activeCategory.value = id
      centerChip(id)
    }
  }, { rootMargin: '-180px 0px -60% 0px' })
  document.querySelectorAll('.menu__section').forEach((el) => observer!.observe(el))
})

onBeforeUnmount(() => observer?.disconnect())

// --- Produto / sacola ---
const selected = ref<Product | null>(null)

function open(p: Product): void {
  if (catalog.isOrderable(p)) selected.value = p
}

function qtyInCart(productId: string): number {
  return cartStore.items.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0)
}

function onAdd(payload: { product: Product; qty: number; choices: SelectedChoice[]; note: string }): void {
  cartStore.add(payload.product, payload.qty, payload.choices, payload.note)
  selected.value = null
  navigator.vibrate?.(20)
  toastStore.add(`${payload.qty}× ${payload.product.name} na sacola`, 'success')
}
</script>

<style lang="scss" scoped>
.menu {
  // espaço para a barra da sacola + navegação inferior
  padding-bottom: calc(var(--bottomnav-height) + var(--safe-bottom) + 80px);

  &__header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--color-bg);
    padding: var(--spacing-md) var(--spacing-md) 0;
    border-bottom: 1px solid var(--color-border);
  }

  &__title-row { @include flex-between; gap: var(--spacing-md); }
  &__hello { font-size: 0.8125rem; color: var(--color-text-muted); }
  &__title { font-family: var(--font-display); font-size: 1.625rem; font-weight: 700; line-height: 1.1; }

  &__search {
    position: relative;
    margin-top: var(--spacing-md);

    svg {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      fill: none;
      stroke: var(--color-text-muted);
      stroke-width: 2;
      stroke-linecap: round;
    }

    input {
      width: 100%;
      height: 46px;
      padding: 0 var(--spacing-md) 0 42px;
      border: 1px solid var(--color-border);
      border-radius: 99px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 1rem;
      &:focus { outline: none; border-color: var(--color-primary); }
    }
  }

  &__chips {
    display: flex;
    gap: var(--spacing-sm);
    overflow-x: auto;
    margin: 0 calc(-1 * var(--spacing-md));
    padding: var(--spacing-md);
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  &__section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg) var(--spacing-md) var(--spacing-xs);
    font-family: var(--font-display);
    font-size: 1.25rem;
    &::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, var(--color-primary), transparent); opacity: 0.6; }
  }

  &__list { background: var(--color-surface); min-height: 60dvh; }

  &__results {
    padding: var(--spacing-md);
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__empty {
    padding: var(--spacing-xl) var(--spacing-md);
    text-align: center;
    color: var(--color-text-muted);
    span { font-size: 2rem; }
  }
}

.chip {
  @include button-reset;
  flex-shrink: 0;
  height: 36px;
  padding: 0 14px;
  border-radius: 99px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all var(--transition);

  &--active {
    background: var(--color-ink);
    border-color: var(--color-ink);
    color: var(--color-accent-text);
  }
}
</style>
