<template><span hidden /></template>

<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Layout } from '@/router'
import { onBeforeUnmount } from 'vue'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useToastStore }    from '@/stores/useToastStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useReadyNotifier } from '@/composables/useReadyNotifier'

// Efeitos que só existem dentro de uma loja (as stores dependem dela)
const props = defineProps<{ layout: Layout }>()

const customer = useCustomerStore()
const staff    = useStaffStore()
const toast    = useToastStore()
const settings = useSettingsStore()
const route    = useRoute()
const router   = useRouter()

const isCustomer = computed(() => props.layout === 'customer' || props.layout === 'customer-bare')

// Tema: cliente sempre claro dourado; equipe conforme Configurações
watchEffect(() => {
  const dark = props.layout === 'staff' && settings.settings.staffTheme === 'escuro'
  document.documentElement.classList.toggle('theme-dark', dark)
  document.documentElement.classList.toggle('theme-light', !dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1A1A1A' : '#FAF7F1')
})

// Título da aba: nome da loja (+ módulo da equipe)
watchEffect(() => {
  const name = settings.tenant.name
  document.title = props.layout === 'staff' ? `${name} · Equipe` : name
})

// Avisos de pedido pronto só nas telas do cliente
useReadyNotifier(isCustomer)

// Erros do banco: sessão da equipe recusada volta para o login; falha de
// gravação avisa na tela (o console tem o detalhe)
function onDbError(e: Event) {
  const { action, err } = (e as CustomEvent).detail as { action: string; err: { code?: string } }
  if (err?.code === 'permission-denied' && staff.role && action === 'assinar') {
    staff.logout()
    toast.add('Sua sessão da equipe expirou. Entre de novo com o PIN.', 'error')
    router.replace({ name: 'staff-login', query: { redirect: route.fullPath } })
  } else if (action !== 'assinar') {
    toast.add('Não foi possível salvar. Verifique a conexão e tente de novo.', 'error')
  }
}
window.addEventListener('db-error', onDbError)
onBeforeUnmount(() => window.removeEventListener('db-error', onDbError))

// O caixa fechou a conta: o celular do cliente volta para a entrada com agradecimento
watch(() => customer.wasClosed, (closed) => {
  if (!closed) return
  customer.release()
  if (route.meta.layout === 'customer') router.replace({ name: 'scan', query: { encerrada: '1' } })
})
</script>
