<template>
  <div class="tenants">
    <header class="tenants__head">
      <p class="eyebrow">Plataforma de autoatendimento</p>
      <h1>Escolha o estabelecimento</h1>
      <p>Cada casa tem seu cardápio, sua equipe e sua marca. O cliente entra pelo QR da comanda e cai direto na casa certa.</p>
    </header>

    <ul class="tenants__list">
      <li v-for="t in list" :key="t.slug" class="tenant">
        <span class="tenant__logo" aria-hidden="true">{{ t.logoEmoji }}</span>
        <div class="tenant__info">
          <h2>{{ t.name }}</h2>
          <p>{{ t.tagline }} · {{ t.city }}</p>
        </div>
        <div class="tenant__actions">
          <a :href="`/${t.slug}`" class="tenant__btn tenant__btn--ink">App do cliente</a>
          <a :href="`/${t.slug}/equipe`" class="tenant__btn">Equipe</a>
        </div>
      </li>
      <li class="tenant tenant--new" aria-disabled="true">
        <span class="tenant__logo" aria-hidden="true">+</span>
        <div class="tenant__info">
          <h2>Novo estabelecimento</h2>
          <p>Cadastro de lojas chega junto com o backend.</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { tenants } from '@/mock/tenants'

const list = Object.values(tenants).map((b) => b.tenant)
</script>

<style lang="scss" scoped>
.tenants {
  min-height: 100dvh;
  max-width: 640px;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);

  &__head {
    text-align: center;
    h1 { font-family: var(--font-display); font-size: 2rem; margin: 6px 0; }
    p:last-child { color: var(--color-text-muted); }
  }

  &__list { display: flex; flex-direction: column; gap: var(--spacing-md); }
}

.tenant {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);

  &--new { border-style: dashed; box-shadow: none; opacity: 0.6; }

  &__logo {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 1px solid var(--color-primary);
    font-size: 1.5rem;
    color: var(--color-accent-text);
    @include flex-center;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    min-width: 160px;
    h2 { font-family: var(--font-display); font-size: 1.5rem; }
    p  { font-size: 0.875rem; color: var(--color-text-muted); }
  }

  &__actions { display: flex; gap: var(--spacing-sm); }

  &__btn {
    display: inline-flex;
    align-items: center;
    height: 40px;
    padding: 0 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    font-size: 0.875rem;
    font-weight: 500;

    &--ink { background: var(--color-ink); color: var(--color-on-ink); border-color: var(--color-ink); }
  }
}
</style>
