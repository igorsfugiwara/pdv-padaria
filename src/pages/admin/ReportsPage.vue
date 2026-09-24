<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Relatórios</h1>
        <p class="page__subtitle">Vendas pagas, custo pela ficha técnica e desempenho da cozinha</p>
      </div>
      <div class="page__actions">
        <AppButton variant="outline" size="sm" @click="exportProducts">Exportar produtos (CSV)</AppButton>
      </div>
    </header>

    <!-- Filtro único, acima de tudo que ele afeta -->
    <div class="segmented" role="tablist" aria-label="Período">
      <button
        v-for="(label, key) in periodLabels"
        :key="key"
        :class="['segmented__btn', { 'segmented__btn--active': period === key }]"
        @click="period = key"
      >{{ label }}</button>
    </div>

    <div class="tiles">
      <StatTile label="Faturamento" :value="formatMoneyCompact(report.revenue)" :hint="plural(report.count, 'comanda paga', 'comandas pagas')" hero />
      <StatTile label="Ticket médio" :value="formatMoney(report.avgTicket)" :hint="report.discount ? `${formatMoney(report.discount)} em descontos` : 'Sem descontos'" />
      <StatTile label="CMV (ficha técnica)" :value="formatMoneyCompact(report.cmv)" :hint="report.netSales ? `${formatPercent(report.cmv / report.netSales, 1)} das vendas` : '—'" />
      <StatTile
        label="Margem bruta"
        :value="report.netSales ? formatPercent(report.grossMargin, 1) : '—'"
        :hint="`Lucro bruto ${formatMoneyCompact(report.netSales - report.cmv)}`"
        :hint-tone="report.grossMargin >= 0.65 ? 'success' : report.grossMargin >= 0.5 ? 'warning' : 'danger'"
      />
      <StatTile
        label="Tempo médio de cozinha"
        :value="report.kitchen.count ? formatDuration(report.kitchen.avgMinutes) : '—'"
        :hint="`${formatPercent(report.kitchen.lateShare)} dos pedidos acima de ${settings.lateMinutes} min`"
        :hint-tone="report.kitchen.lateShare > 0.15 ? 'danger' : report.kitchen.lateShare > 0.05 ? 'warning' : 'success'"
      />
    </div>

    <BarChart
      :title="period === 'today' ? 'Pedidos por hora' : 'Faturamento por dia'"
      :subtitle="period === 'today' ? 'Valor pedido em cada hora (inclui comandas abertas)' : 'Soma das comandas pagas em cada dia'"
      :points="report.series"
      :format="formatMoney"
      :format-tick="formatMoneyCompact"
      :label-header="period === 'today' ? 'Hora' : 'Dia'"
      value-header="Valor"
      :height="240"
    />

    <div class="two-col">
      <HBarList
        title="Por forma de pagamento"
        :rows="report.byMethod.map((m) => ({ key: m.method, label: methodLabels[m.method], value: m.amount }))"
        :format="formatMoney"
      />
      <HBarList
        title="Por categoria"
        subtitle="Valor vendido dos itens (antes de desconto)"
        :rows="report.byCategory.map((c) => ({ key: c.id, label: c.name, value: c.revenue }))"
        :format="formatMoney"
      />
    </div>

    <section class="panel">
      <div class="panel__head">
        <h3>Produtos</h3>
        <span class="muted">{{ report.topProducts.length }} vendidos no período</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th class="num">Qtd</th>
              <th class="num">Receita</th>
              <th class="num">Custo</th>
              <th class="num">Margem</th>
              <th class="num">% da receita</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in visibleProducts" :key="p.id">
              <td data-label="Produto"><span class="prod"><span>{{ p.emoji }}</span>{{ p.name }}</span></td>
              <td data-label="Qtd" class="num">{{ p.qty }}</td>
              <td data-label="Receita" class="num">{{ formatMoney(p.revenue) }}</td>
              <td data-label="Custo" class="num">{{ formatMoney(p.cost) }}</td>
              <td data-label="Margem" :class="['num', marginClass(margin(p.revenue, p.cost))]">{{ formatPercent(margin(p.revenue, p.cost)) }}</td>
              <td data-label="% da receita" class="num">{{ formatPercent(p.revenue / productsRevenue, 1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button v-if="report.topProducts.length > 10" class="show-all" @click="showAll = !showAll">
        {{ showAll ? 'Mostrar só os 10 primeiros' : `Mostrar todos (${report.topProducts.length})` }}
      </button>
      <p v-if="!report.topProducts.length" class="panel__empty">Nenhuma venda paga no período.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useReport } from '@/composables/useReport'
import { toCSV, downloadFile, centsToReal } from '@/composables/useExport'
import { periodLabels, type PeriodKey } from '@/lib/reports'
import { margin } from '@/lib/recipe'
import { formatMoney, formatMoneyCompact, formatPercent, formatDuration, methodLabels, plural } from '@/lib/format'
import AppButton from '@/components/ui/AppButton.vue'
import StatTile  from '@/components/ui/StatTile.vue'
import BarChart  from '@/components/charts/BarChart.vue'
import HBarList  from '@/components/charts/HBarList.vue'

const settings = useSettingsStore().settings
const period   = ref<PeriodKey>('7d')
const report   = useReport(period)
const showAll  = ref(false)

const visibleProducts = computed(() => (showAll.value ? report.value.topProducts : report.value.topProducts.slice(0, 10)))
const productsRevenue = computed(() => report.value.topProducts.reduce((s, p) => s + p.revenue, 0) || 1)

function marginClass(m: number): string {
  return m >= 0.65 ? 'is-ok' : m >= 0.5 ? 'is-warn' : 'is-bad'
}

function exportProducts() {
  const csv = toCSV(
    ['Produto', 'Quantidade', 'Receita (R$)', 'Custo (R$)', 'Margem (%)'],
    report.value.topProducts.map((p) => [
      p.name, p.qty, centsToReal(p.revenue), centsToReal(p.cost),
      (margin(p.revenue, p.cost) * 100).toFixed(1).replace('.', ','),
    ]),
  )
  downloadFile(csv, `produtos-${period.value}-${new Date().toISOString().slice(0, 10)}.csv`)
}
</script>

<style lang="scss" scoped>
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  align-items: start;
  @media (max-width: 1023px) { grid-template-columns: 1fr; }
}

.muted { color: var(--color-text-muted); font-size: 0.8125rem; }
.prod { display: inline-flex; gap: var(--spacing-sm); align-items: center; }

.show-all {
  @include button-reset;
  width: 100%;
  padding: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  &:hover { color: var(--color-text); }
}

.is-ok   { color: var(--color-success); }
.is-warn { color: var(--color-warning); }
.is-bad  { color: var(--color-danger); }
</style>
