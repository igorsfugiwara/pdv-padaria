<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Estoque</h1>
        <p class="page__subtitle">Insumos e produção da casa. Cada venda baixa o que a ficha técnica consome.</p>
      </div>
      <div class="page__actions">
        <AppButton variant="outline" @click="openMove(null, 'producao')">+ Produção</AppButton>
        <AppButton @click="openMove(null, 'compra')">+ Entrada de compra</AppButton>
      </div>
    </header>

    <div v-if="catalog.lowStock.length" class="alert alert--warning">
      <span>⚠</span>
      <span>
        <strong>{{ catalog.lowStock.length }} insumos no mínimo ou abaixo:</strong>
        {{ catalog.lowStock.map((i) => i.name).join(', ') }}.
        <template v-if="blockedProducts.length"> Esgotados por falta de insumo: {{ blockedProducts.map((p) => p.name).join(', ') }}.</template>
      </span>
    </div>

    <div class="tiles">
      <StatTile label="Valor em estoque" :value="formatMoney(stockValue)" hint="Saldo × custo médio" />
      <StatTile label="Consumo teórico hoje" :value="formatMoney(consumptionTotal)" hint="Pela ficha técnica dos pedidos" />
      <StatTile label="Perdas nos últimos 7 dias" :value="formatMoney(lossValue)" :hint="plural(lossCount, 'registro', 'registros')" :hint-tone="lossCount ? 'warning' : 'success'" />
    </div>

    <div class="toolbar">
      <div class="segmented">
        <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'saldo' }]" @click="tab = 'saldo'">Saldo</button>
        <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'consumo' }]" @click="tab = 'consumo'">Consumo de hoje</button>
        <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'movimentos' }]" @click="tab = 'movimentos'">Movimentações</button>
      </div>
      <input v-if="tab !== 'movimentos'" v-model="search" class="input toolbar__search" placeholder="Buscar insumo" aria-label="Buscar insumo" />
      <AppButton v-if="tab === 'saldo' && staff.isAdmin" variant="ghost" size="sm" @click="showNewInsumo = true">+ Novo insumo</AppButton>
    </div>

    <!-- Saldo -->
    <section v-if="tab === 'saldo'" class="panel">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Situação</th>
              <th class="num">Saldo</th>
              <th class="num">Mínimo</th>
              <th class="num">Custo médio</th>
              <th class="num">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in insumoRows" :key="i.id">
              <td data-label="Insumo">
                {{ i.name }}
                <small class="muted">{{ i.produced ? 'produção da casa' : i.supplier }}</small>
              </td>
              <td data-label="Situação">
                <AppBadge :tone="i.stock <= 0 ? 'danger' : i.stock <= i.minStock ? 'warning' : 'success'">
                  {{ i.stock <= 0 ? 'Zerado' : i.stock <= i.minStock ? 'Baixo' : 'OK' }}
                </AppBadge>
              </td>
              <td data-label="Saldo" class="num"><strong>{{ formatQty(i.stock, i.unit) }}</strong></td>
              <td data-label="Mínimo" class="num">{{ formatQty(i.minStock, i.unit) }}</td>
              <td data-label="Custo médio" class="num">{{ formatMoney(i.avgCost) }}/{{ i.unit }}</td>
              <td data-label="Valor" class="num">{{ formatMoney(Math.max(i.stock, 0) * i.avgCost) }}</td>
              <td class="actions">
                <button class="ghost-btn" @click="openMove(i.id, i.produced ? 'producao' : 'compra')">+ Entrada</button>
                <button class="ghost-btn" @click="openMove(i.id, 'perda')">Perda</button>
                <button class="ghost-btn" @click="openMove(i.id, 'ajuste')">Ajustar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Consumo de hoje -->
    <section v-else-if="tab === 'consumo'" class="panel">
      <div class="panel__head">
        <h3>Consumo teórico de hoje</h3>
        <span class="muted">Compare com a contagem física para achar desperdício</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Insumo</th><th class="num">Consumido</th><th class="num">Custo</th><th class="num">Saldo agora</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in consumptionRows" :key="c.insumo.id">
              <td data-label="Insumo">{{ c.insumo.name }}</td>
              <td data-label="Consumido" class="num">{{ formatQty(c.qty, c.insumo.unit) }}</td>
              <td data-label="Custo" class="num">{{ formatMoney(c.cost) }}</td>
              <td data-label="Saldo agora" class="num">{{ formatQty(c.insumo.stock, c.insumo.unit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!consumptionRows.length" class="panel__empty">Nenhum consumo registrado hoje.</p>
    </section>

    <!-- Movimentações -->
    <section v-else class="panel">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Quando</th><th>Tipo</th><th>Insumo</th><th class="num">Quantidade</th><th class="num">Custo/un</th><th>Detalhe</th><th>Por</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in catalog.stockMoves" :key="m.id">
              <td data-label="Quando">{{ formatDateTime(m.createdAt) }}</td>
              <td data-label="Tipo"><AppBadge :tone="moveTone[m.type]">{{ moveLabels[m.type] }}</AppBadge></td>
              <td data-label="Insumo">{{ m.insumoName }}</td>
              <td data-label="Quantidade" class="num">{{ m.qty > 0 ? '+' : '' }}{{ formatQty(m.qty, unitOf(m.insumoId)) }}</td>
              <td data-label="Custo/un" class="num">{{ m.unitCost !== undefined ? formatMoney(m.unitCost) : '—' }}</td>
              <td data-label="Detalhe" class="muted">{{ [m.supplier, m.note].filter(Boolean).join(' · ') || '—' }}</td>
              <td data-label="Por">{{ m.operator }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!catalog.stockMoves.length" class="panel__empty">Nenhuma movimentação registrada.</p>
    </section>
  </div>

  <!-- Movimentação -->
  <AppModal v-model="showMove" :title="moveTitle" size="sm">
    <div class="form-stack">
      <div class="field">
        <span class="field__label">Insumo</span>
        <select v-model="move.insumoId" class="select">
          <option v-for="i in catalog.insumos" :key="i.id" :value="i.id">{{ i.name }} ({{ i.unit }})</option>
        </select>
      </div>
      <div class="segmented">
        <button v-for="t in moveTypes" :key="t" :class="['segmented__btn', { 'segmented__btn--active': move.type === t }]" @click="move.type = t">{{ moveLabels[t] }}</button>
      </div>
      <div class="field">
        <span class="field__label">
          {{ move.type === 'ajuste' ? `Saldo contado (${moveInsumo?.unit})` : `Quantidade (${moveInsumo?.unit})` }}
        </span>
        <input v-model.number="move.qty" class="input" type="number" min="0" step="any" />
        <span v-if="move.type === 'ajuste' && moveInsumo" class="field__hint">
          Sistema: {{ formatQty(moveInsumo.stock, moveInsumo.unit) }} → diferença de {{ formatQty((move.qty || 0) - moveInsumo.stock, moveInsumo.unit) }}
        </span>
      </div>
      <template v-if="move.type === 'compra' || move.type === 'producao'">
        <AppInput v-model="move.unitCost" :label="`Custo por ${moveInsumo?.unit ?? 'unidade'}`" variant="money" />
        <div v-if="move.type === 'compra'" class="field">
          <span class="field__label">Fornecedor</span>
          <input v-model="move.supplier" class="input" :placeholder="moveInsumo?.supplier" />
        </div>
      </template>
      <div class="field">
        <span class="field__label">{{ move.type === 'perda' ? 'Motivo' : 'Observação / nota fiscal' }}</span>
        <input v-model="move.note" class="input" :placeholder="move.type === 'perda' ? 'Obrigatório' : 'Opcional'" />
      </div>
    </div>
    <template #footer>
      <AppButton variant="ghost" @click="showMove = false">Cancelar</AppButton>
      <AppButton :disabled="!canSaveMove" @click="saveMove">Registrar</AppButton>
    </template>
  </AppModal>

  <!-- Novo insumo -->
  <AppModal v-model="showNewInsumo" title="Novo insumo" size="sm">
    <div class="form-stack">
      <div class="field">
        <span class="field__label">Nome</span>
        <input v-model="newInsumo.name" class="input" />
      </div>
      <div class="form-grid">
        <div class="field">
          <span class="field__label">Unidade</span>
          <select v-model="newInsumo.unit" class="select">
            <option value="kg">kg</option>
            <option value="l">litro</option>
            <option value="un">unidade</option>
          </select>
        </div>
        <div class="field">
          <span class="field__label">Estoque mínimo</span>
          <input v-model.number="newInsumo.minStock" class="input" type="number" min="0" step="any" />
        </div>
      </div>
      <AppInput v-model="newInsumo.avgCost" :label="`Custo por ${newInsumo.unit}`" variant="money" />
      <label class="toggle">
        <button type="button" :class="['switch', { 'switch--on': newInsumo.produced }]" role="switch" :aria-checked="newInsumo.produced" @click="newInsumo.produced = !newInsumo.produced" />
        Produzido na casa
      </label>
    </div>
    <template #footer>
      <AppButton variant="ghost" @click="showNewInsumo = false">Cancelar</AppButton>
      <AppButton :disabled="!newInsumo.name.trim()" @click="saveInsumo">Cadastrar</AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Insumo, StockMove, Unit } from '@/types'
import { useCatalogStore } from '@/stores/useCatalogStore'
import { useOrderStore }   from '@/stores/useOrderStore'
import { useStaffStore }   from '@/stores/useStaffStore'
import { useToastStore }   from '@/stores/useToastStore'
import { formatMoney, formatQty, formatDateTime, plural } from '@/lib/format'
import { fullRecipe } from '@/lib/recipe'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge  from '@/components/ui/AppBadge.vue'
import AppModal  from '@/components/ui/AppModal.vue'
import AppInput  from '@/components/ui/AppInput.vue'
import StatTile  from '@/components/ui/StatTile.vue'

const catalog = useCatalogStore()
const orders  = useOrderStore()
const staff   = useStaffStore()
const toast   = useToastStore()

const tab    = ref<'saldo' | 'consumo' | 'movimentos'>('saldo')
const search = ref('')

const moveLabels: Record<StockMove['type'], string> = { compra: 'Compra', producao: 'Produção', perda: 'Perda', ajuste: 'Ajuste' }
const moveTone: Record<StockMove['type'], 'success' | 'gold' | 'danger' | 'muted'> = { compra: 'success', producao: 'gold', perda: 'danger', ajuste: 'muted' }
const moveTypes: StockMove['type'][] = ['compra', 'producao', 'perda', 'ajuste']

const unitOf = (id: string): Unit => catalog.insumoIndex.get(id)?.unit ?? 'un'

// Críticos primeiro
const insumoRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rank = (i: Insumo) => (i.stock <= 0 ? 0 : i.stock <= i.minStock ? 1 : 2)
  return catalog.insumos
    .filter((i) => !q || i.name.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
})

const blockedProducts = computed(() => catalog.activeProducts.filter((p) => catalog.missingInsumo(p)))
const stockValue = computed(() => catalog.insumos.reduce((s, i) => s + Math.max(i.stock, 0) * i.avgCost, 0))

// --- Consumo teórico de hoje ---
const consumption = computed(() => {
  const map = new Map<string, number>()
  orders.today.forEach((o) => o.items.forEach((item) => {
    if (item.cancelled) return
    const p = catalog.productById.get(item.productId)
    if (!p) return
    fullRecipe(p, item.choices).forEach((l) => map.set(l.insumoId, (map.get(l.insumoId) ?? 0) + l.qty * item.quantity))
  }))
  return map
})

const consumptionRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return [...consumption.value.entries()]
    .map(([id, qty]) => {
      const insumo = catalog.insumoIndex.get(id)!
      return { insumo, qty, cost: Math.round(qty * insumo.avgCost) }
    })
    .filter((r) => r.insumo && (!q || r.insumo.name.toLowerCase().includes(q)))
    .sort((a, b) => b.cost - a.cost)
})

const consumptionTotal = computed(() => consumptionRows.value.reduce((s, r) => s + r.cost, 0))

const recentLosses = computed(() => {
  const since = Date.now() - 7 * 86_400_000
  return catalog.stockMoves.filter((m) => m.type === 'perda' && new Date(m.createdAt).getTime() >= since)
})
const lossCount = computed(() => recentLosses.value.length)
const lossValue = computed(() => recentLosses.value.reduce((s, m) => s + Math.abs(m.qty) * (catalog.insumoIndex.get(m.insumoId)?.avgCost ?? 0), 0))

// --- Movimentação ---
const showMove = ref(false)
const move = ref({ insumoId: '', type: 'compra' as StockMove['type'], qty: 0, unitCost: 0, supplier: '', note: '' })
const moveInsumo = computed(() => catalog.insumoIndex.get(move.value.insumoId))
const moveTitle  = computed(() => `${moveLabels[move.value.type]}${moveInsumo.value ? ` · ${moveInsumo.value.name}` : ''}`)

function openMove(insumoId: string | null, type: StockMove['type']) {
  const id  = insumoId ?? catalog.insumos.find((i) => (type === 'producao' ? i.produced : !i.produced))?.id ?? catalog.insumos[0].id
  const ins = catalog.insumoIndex.get(id)
  move.value = {
    insumoId: id, type,
    qty: type === 'ajuste' ? ins?.stock ?? 0 : 0,
    unitCost: ins?.avgCost ?? 0,
    supplier: '', note: '',
  }
  showMove.value = true
}

const canSaveMove = computed(() => {
  const m = move.value
  if (!m.insumoId || !(m.qty >= 0)) return false
  if (m.type === 'ajuste') return true
  if (m.type === 'perda') return m.qty > 0 && !!m.note.trim()
  return m.qty > 0
})

function saveMove() {
  const m   = move.value
  const ins = moveInsumo.value
  if (!ins) return
  const qty =
    m.type === 'ajuste' ? m.qty - ins.stock :
    m.type === 'perda'  ? -m.qty :
    m.qty
  catalog.addMove({
    insumoId: m.insumoId,
    type: m.type,
    qty,
    unitCost: m.type === 'compra' || m.type === 'producao' ? m.unitCost : undefined,
    supplier: m.type === 'compra' ? m.supplier.trim() || ins.supplier : undefined,
    note: m.note.trim() || undefined,
    operator: staff.user?.name ?? 'Equipe',
  })
  showMove.value = false
  toast.add(`${moveLabels[m.type]} registrada: ${ins.name}.`, 'success')
}

// --- Novo insumo ---
const showNewInsumo = ref(false)
const newInsumo = ref({ name: '', unit: 'kg' as Unit, minStock: 0, avgCost: 0, produced: false })

function saveInsumo() {
  catalog.addInsumo({ ...newInsumo.value, name: newInsumo.value.name.trim(), stock: 0 })
  toast.add(`${newInsumo.value.name} cadastrado. Registre uma entrada para ter saldo.`, 'success')
  newInsumo.value = { name: '', unit: 'kg', minStock: 0, avgCost: 0, produced: false }
  showNewInsumo.value = false
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  &__search { max-width: 260px; }
}

.muted { color: var(--color-text-muted); font-size: 0.8125rem; }
td small.muted { display: block; font-size: 0.75rem; }

.actions { white-space: nowrap; text-align: right; }

.ghost-btn {
  @include button-reset;
  font-size: 0.8125rem;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  &:hover { color: var(--color-accent-text); background: var(--color-primary-soft); }
}

.toggle { display: inline-flex; align-items: center; gap: var(--spacing-sm); font-size: 0.9375rem; }
</style>
