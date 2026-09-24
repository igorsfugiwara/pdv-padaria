<template>
  <div :class="['app', `app--${layout}`]">
    <RouterView />
    <BottomNav v-if="layout === 'customer'" />
  </div>
  <TenantEffects v-if="hasTenant" :layout="layout" />
  <AppToastContainer />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import type { Layout } from '@/router'
import { bootTenantSlug } from '@/mock/tenants'
import AppToastContainer from '@/components/ui/AppToastContainer.vue'

// Componentes que usam stores da loja só carregam quando há loja na URL
const BottomNav     = defineAsyncComponent(() => import('@/components/customer/BottomNav.vue'))
const TenantEffects = defineAsyncComponent(() => import('@/components/TenantEffects.vue'))

const route     = useRoute()
const hasTenant = bootTenantSlug() !== null
const layout    = computed<Layout>(() => route.meta.layout ?? 'tenants')
</script>

<style lang="scss">
@use '@/styles/main';

.app {
  min-height: 100dvh;

  // App do cliente: coluna de celular centralizada, mesmo no desktop
  &--customer,
  &--customer-bare {
    max-width: var(--shell-width);
    margin: 0 auto;
    background: var(--color-bg);

    @media (min-width: 520px) {
      box-shadow: 0 0 0 1px var(--color-border), var(--shadow-lg);
    }
  }
}

// Fora da coluna do cliente, um fundo levemente mais escuro emoldura o "celular"
@media (min-width: 520px) {
  html.theme-light body:has(.app--customer),
  html.theme-light body:has(.app--customer-bare) { background: #EFE8DA; }
}
</style>
