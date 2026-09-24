import { computed, type Ref } from 'vue'
import { useComandasStore } from '@/stores/useComandasStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { getHistory } from '@/mock/history'
import { buildReport, type PeriodKey } from '@/lib/reports'

// Junta o histórico gerado (dias anteriores) com os dados vivos de hoje
export function useReport(period: Ref<PeriodKey>) {
  const comandas = useComandasStore()
  const orders   = useOrderStore()
  const catalog  = useCatalogStore()
  const settings = useSettingsStore()

  const history = computed(() =>
    getHistory(settings.tenant.slug, catalog.products, catalog.insumos, settings.settings)
  )

  return computed(() => {
    const withHistory = period.value !== 'today'
    return buildReport(
      period.value,
      withHistory ? [...history.value.comandas, ...comandas.sessions] : comandas.sessions,
      withHistory ? [...history.value.orders, ...orders.orders] : orders.orders,
      catalog.categories,
      settings.settings.lateMinutes,
    )
  })
}
