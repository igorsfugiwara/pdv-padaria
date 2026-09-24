<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">{{ greeting }}, {{ staff.user?.name }}</h1>
        <p class="page__subtitle">{{ today }} · dados de hoje, atualizados em tempo real</p>
      </div>
      <div class="page__actions">
        <AppButton variant="outline" size="sm" @click="router.push({ name: 'salon' })">Abrir salão</AppButton>
        <AppButton variant="outline" size="sm" @click="router.push({ name: 'admin-comandas' })">Comandas</AppButton>
      </div>
    </header>

    <div class="tiles">
      <StatTile label="Faturamento hoje" :value="formatMoney(report.revenue)" :hint="plural(report.count, 'comanda paga', 'comandas pagas')" hero />
      <StatTile
        label="Em aberto agora"
        :value="formatMoney(openTotal)"
        :hint="plural(comandas.openSessions.length, 'comanda aberta', 'comandas abertas')"
      />
      <StatTile
        label="Ticket médio"
        :value="formatMoney(report.avgTicket)"
        :hint="plural(orders.today.length, 'pedido hoje', 'pedidos hoje')"
      />
      <StatTile
        label="Tempo médio de cozinha"
        :value="report.kitchen.count ? formatDuration(report.kitchen.avgMinutes) : '—'"
        :hint="report.kitchen.count ? `${formatPercent(report.kitchen.lateShare)} acima de ${settings.lateMinutes} min` : 'Sem pedidos prontos ainda'"
        :hint-tone="report.kitchen.lateShare > 0.15 ? 'danger' : report.kitchen.lateShare > 0.05 ? 'warning' : 'success'"
      />
      <StatTile
        label="Margem bruta (ficha técnica)"
        :value="report.netSales ? formatPercent(report.grossMargin) : '—'"
        :hint="`CMV ${formatMoney(report.cmv)}`"
      />
    </div>

    <div class="dash-grid">
      <BarChart
        title="Pedidos por hora"
        subtitle="Valor pedido em cada hora, incluindo comandas ainda abertas"
        :points="report.series"
        :format="formatMoney"
        :format-tick="formatMoneyCompact"
        label-header="Hora"
        value-header="Valor pedido"
      />

      <section class="panel live">
        <div class="panel__head">
          <h3>Agora na operação</h3>
          <RouterLink :to="{ name: 'salon' }" class="link">Ver salão →</RouterLink>
        </div>
        <div class="live__grid">
          <div class="live__item">
            <strong>{{ countBy('received') }}</strong><span>Aguardando cozinha</span>
          </div>
          <div class="live__item">
            <strong>{{ countBy('preparing') }}</strong><span>Em preparo</span>
          </div>
          <div class="live__item live__item--gold">
            <strong>{{ countBy('ready') }}</strong><span>Prontos para levar</span>
          </div>
          <div :class="['live__item', { 'live__item--danger': lateNow > 0 }]">
            <strong>{{ lateNow }}</strong><span>Atrasados (+{{ settings.lateMinutes }} min)</span>
          </div>
        </div>
      </section>
    </div>

    <div class="dash-grid dash-grid--even">
      <section class="panel">
        <div class="panel__head">
          <h3>Mais pedidos hoje</h3>
        </div>
        <ul v-if="topToday.length" class="rank">
          <li v-for="(p, i) in topToday" :key="p.id" class="rank__row">
            <span class="rank__pos">{{ i + 1 }}</span>
            <span class="rank__emoji">{{ p.emoji }}</span>
            <span class="rank__name">{{ p.name }}</span>
            <span class="rank__qty num">{{ p.qty }}×</span>
            <span class="rank__value num">{{ formatMoney(p.revenue) }}</span>
          </li>
        </ul>
        <p v-else class="panel__empty">Nenhum pedido ainda hoje.</p>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h3>Estoque em alerta</h3>
          <RouterLink :to="{ name: 'admin-estoque' }" class="link">Ver estoque →</RouterLink>
        </div>
        <ul v-if="catalog.lowStock.length" class="rank">
          <li v-for="i in catalog.lowStock.slice(0, 6)" :key="i.id" class="rank__row">
            <AppBadge :tone="i.stock <= 0 ? 'danger' : 'warning'">{{ i.stock <= 0 ? 'Zerado' : 'Baixo' }}</AppBadge>
            <span class="rank__name">{{ i.name }}</span>
            <span class="rank__value num">{{ formatQty(i.stock, i.unit) }} <small>/ mín. {{ formatQty(i.minStock, i.unit) }}</small></span>
          </li>
        </ul>
        <p v-else class="panel__empty">Todos os insumos acima do mínimo.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { OrderStatus } from '@/types'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useReport } from '@/composables/useReport'
import { useNow } from '@/composables/useNow'
import { formatMoney, formatMoneyCompact, formatPercent, formatDuration, formatQty, plural } from '@/lib/format'
import { kitchenMinutes } from '@/lib/timing'
import type { PeriodKey } from '@/lib/reports'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge  from '@/components/ui/AppBadge.vue'
import StatTile  from '@/components/ui/StatTile.vue'
import BarChart  from '@/components/charts/BarChart.vue'

const staff    = useStaffStore()
const orders   = useOrderStore()
const comandas = useComandasStore()
const catalog  = useCatalogStore()
const settings = useSettingsStore().settings
const router   = useRouter()
const now      = useNow(30_000)

const report = useReport(ref<PeriodKey>('today'))

const greeting = computed(() => {
  const h = new Date(now.value).getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
})
const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

const openTotal = computed(() => comandas.openSessions.reduce((s, c) => s + orders.comandaSubtotal(c.id), 0))

function countBy(status: OrderStatus): number {
  return orders.active.filter((o) => o.status === status).length
}

const lateNow = computed(() =>
  orders.active.filter((o) => o.status !== 'ready' && kitchenMinutes(o, now.value) >= settings.lateMinutes).length
)

// Tudo que foi pedido hoje (pago ou não), por valor
const topToday = computed(() => {
  const map = new Map<string, { id: string; name: string; emoji: string; qty: number; revenue: number }>()
  orders.today.forEach((o) => o.items.forEach((i) => {
    if (i.cancelled) return
    const e = map.get(i.productId) ?? { id: i.productId, name: i.productName, emoji: i.emoji, qty: 0, revenue: 0 }
    e.qty += i.quantity
    e.revenue += i.unitPrice * i.quantity
    map.set(i.productId, e)
  }))
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)
})
</script>

<style lang="scss" scoped>
.page__title { text-transform: none; }

.dash-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--spacing-md);
  align-items: start;
  @media (max-width: 1023px) { grid-template-columns: 1fr; }

  &--even { grid-template-columns: 1fr 1fr; @media (max-width: 1023px) { grid-template-columns: 1fr; } }
}

.link { font-size: 0.8125rem; color: var(--color-accent-text); }

.live__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--color-border);
}

.live__item {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
  background: var(--color-surface);

  strong { font-size: 1.75rem; font-weight: 600; line-height: 1.1; }
  span { font-size: 0.8125rem; color: var(--color-text-muted); }

  &--gold strong   { color: var(--color-accent-text); }
  &--danger strong { color: var(--color-danger); }
}

.rank {
  &__row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 10px var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.875rem;
    &:last-child { border-bottom: none; }
  }

  &__pos { width: 18px; color: var(--color-text-muted); font-family: var(--font-mono); font-size: 0.8125rem; }
  &__emoji { font-size: 1.125rem; }
  &__name { flex: 1; min-width: 0; @include truncate; }
  &__qty { color: var(--color-text-muted); }
  &__value { font-weight: 500; small { color: var(--color-text-muted); font-weight: 400; } }
}
</style>
