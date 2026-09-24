<template>
  <AppModal :model-value="!!session" :title="session ? `Adicionar itens · ${comandaLabel(session.number)}` : ''" size="xl" @update:model-value="close">
    <div v-if="session" class="add">
      <!-- Catálogo -->
      <section class="add__catalog">
        <div class="add__toolbar">
          <input v-model="search" class="input" placeholder="Buscar produto" aria-label="Buscar produto" />
          <select v-model="category" class="select add__cat" aria-label="Categoria">
            <option value="">Todas</option>
            <option v-for="c in catalog.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="add__grid">
          <button
            v-for="p in filtered"
            :key="p.id"
            :class="['tile', { 'tile--off': !catalog.isOrderable(p) }]"
            :disabled="!catalog.isOrderable(p)"
            @click="addProduct(p)"
          >
            <span class="tile__emoji">{{ p.emoji }}</span>
            <span class="tile__name">{{ p.name }}</span>
            <span class="tile__price money">{{ catalog.isOrderable(p) ? formatMoney(p.price) : 'Esgotado' }}</span>
          </button>
        </div>
      </section>

      <!-- Itens a lançar -->
      <section class="add__cart">
        <h3>Itens a lançar</h3>
        <p v-if="!lines.length" class="add__empty">Toque nos produtos para adicionar. Adicionais usam a opção padrão.</p>
        <ul v-else class="add__lines">
          <li v-for="(l, i) in lines" :key="i" class="line">
            <div class="line__info">
              <span>{{ l.product.name }}</span>
              <small v-if="l.choices.length">{{ l.choices.map((c) => c.name).join(' · ') }}</small>
            </div>
            <QtyStepper size="sm" removable :model-value="l.qty" @update:model-value="(q) => (q <= 0 ? lines.splice(i, 1) : (l.qty = q))" />
            <span class="line__total money">{{ formatMoney(unitPrice(l.product, l.choices) * l.qty) }}</span>
          </li>
        </ul>

        <div class="add__opts">
          <div class="field">
            <span class="field__label">Entregar em</span>
            <select v-model="destKey" class="select">
              <option value="balcao">Balcão</option>
              <option value="viagem">Para viagem</option>
              <option v-for="n in settings.tables" :key="n" :value="`mesa-${n}`">Mesa {{ n }}</option>
            </select>
          </div>
          <label class="toggle">
            <button type="button" :class="['switch', { 'switch--on': sendToKitchen }]" role="switch" :aria-checked="sendToKitchen" @click="sendToKitchen = !sendToKitchen" />
            <span>
              Enviar para a cozinha
              <small>{{ sendToKitchen ? 'Entra na fila da cozinha e do salão' : 'Entregue agora no balcão' }}</small>
            </span>
          </label>
        </div>

        <div class="add__total">
          <span>Total</span>
          <strong class="money">{{ formatMoney(total) }}</strong>
        </div>
      </section>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="close">Cancelar</AppButton>
      <AppButton :disabled="!lines.length" :loading="saving" @click="save">Lançar {{ lines.length ? formatMoney(total) : '' }}</AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ComandaSession, Destination, Product, SelectedChoice } from '@/types'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useToastStore }    from '@/stores/useToastStore'
import { formatMoney, comandaLabel, formatOrderNumber } from '@/lib/format'
import { unitPrice } from '@/lib/recipe'
import { buildItem, choicesFor } from '@/mock/build'
import AppModal   from '@/components/ui/AppModal.vue'
import AppButton  from '@/components/ui/AppButton.vue'
import QtyStepper from '@/components/ui/QtyStepper.vue'

const props = defineProps<{ session: ComandaSession | null }>()
const emit  = defineEmits<{ close: [] }>()

const catalog  = useCatalogStore()
const orders   = useOrderStore()
const comandas = useComandasStore()
const settings = useSettingsStore().settings
const toast    = useToastStore()

const search        = ref('')
const category      = ref('')
const lines         = ref<{ product: Product; choices: SelectedChoice[]; qty: number }[]>([])
const destKey       = ref('balcao')
const sendToKitchen = ref(false)
const saving        = ref(false)

watch(() => props.session?.id, (id) => {
  if (!id) return
  lines.value = []
  search.value = ''
  const d = props.session?.destination
  destKey.value = d?.type === 'mesa' ? `mesa-${d.table}` : d?.type ?? 'balcao'
  sendToKitchen.value = false
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return catalog.activeProducts.filter((p) =>
    (!category.value || p.categoryId === category.value) && (!q || p.name.toLowerCase().includes(q))
  )
})

const total = computed(() => lines.value.reduce((s, l) => s + unitPrice(l.product, l.choices) * l.qty, 0))

function addProduct(p: Product) {
  const existing = lines.value.find((l) => l.product.id === p.id)
  if (existing) existing.qty++
  else lines.value.push({ product: p, choices: choicesFor(p), qty: 1 })
  // Item de cozinha liga o envio automaticamente
  if (p.station !== 'balcao') sendToKitchen.value = true
}

function destination(): Destination {
  if (destKey.value.startsWith('mesa-')) return { type: 'mesa', table: Number(destKey.value.slice(5)) }
  return { type: destKey.value as 'balcao' | 'viagem' }
}

async function save() {
  if (!props.session || !lines.value.length) return
  saving.value = true
  const items = lines.value.map((l) => {
    const { id: _drop, ...item } = buildItem(l.product, l.qty, catalog.insumoIndex, l.choices)
    return item
  })
  const dest  = destination()
  comandas.setDestination(props.session.id, dest)
  const order = await orders.place(props.session, items, dest, { origin: 'caixa', skipKitchen: !sendToKitchen.value })
  saving.value = false
  toast.add(
    sendToKitchen.value
      ? `Pedido ${formatOrderNumber(order.number)} enviado para a cozinha`
      : `${lines.value.length} ${lines.value.length === 1 ? 'item lançado' : 'itens lançados'}`,
    'success'
  )
  emit('close')
}

function close() { emit('close') }
</script>

<style lang="scss" scoped>
.add {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: var(--spacing-lg);
  min-height: 420px;
  @media (max-width: 767px) { grid-template-columns: 1fr; }

  &__catalog { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; }
  &__toolbar { display: flex; gap: var(--spacing-sm); }
  &__cat { width: 160px; flex-shrink: 0; }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: var(--spacing-xs);
    max-height: 420px;
    overflow-y: auto;
    align-content: start;
    @include scrollbar;
  }

  &__cart {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    h3 { font-size: 0.9375rem; }
  }

  &__empty { font-size: 0.875rem; color: var(--color-text-muted); }
  &__lines { display: flex; flex-direction: column; gap: var(--spacing-sm); }
  &__opts  { display: flex; flex-direction: column; gap: var(--spacing-sm); margin-top: auto; }

  &__total {
    @include flex-between;
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--color-border);
    strong { font-size: 1.25rem; color: var(--color-accent-text); }
  }
}

.tile {
  @include button-reset;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-sm);
  min-height: 84px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  text-align: left;
  transition: border-color var(--transition), transform var(--transition);

  &:hover:not(:disabled) { border-color: var(--color-primary); }
  &:active:not(:disabled) { transform: scale(0.97); }
  &--off { opacity: 0.4; cursor: not-allowed; }

  &__emoji { font-size: 1.25rem; }
  &__name  { font-size: 0.8125rem; font-weight: 500; line-height: 1.3; }
  &__price { margin-top: auto; font-size: 0.8125rem; color: var(--color-accent-text); }
}

.line {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);

  &__info { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 0.875rem; small { color: var(--color-text-muted); font-size: 0.75rem; } }
  &__total { width: 80px; text-align: right; font-size: 0.875rem; }
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.875rem;
  small { display: block; color: var(--color-text-muted); font-size: 0.75rem; }
}
</style>
