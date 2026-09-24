<template>
  <div class="cart">
    <header class="page-header">
      <h1>Sacola</h1>
      <ComandaChip />
    </header>

    <div v-if="!cart.lines.length" class="cart__empty">
      <span aria-hidden="true">🧺</span>
      <h2>Sua sacola está vazia</h2>
      <p>Escolha algo no cardápio e envie direto para a cozinha.</p>
      <AppButton size="lg" variant="ink" @click="router.push({ name: 'menu' })">Ver cardápio</AppButton>
    </div>

    <template v-else>
      <ul class="cart__items">
        <li v-for="line in cart.lines" :key="line.id" :class="['cart-item', { 'cart-item--off': !line.orderable }]">
          <span class="cart-item__emoji" aria-hidden="true">{{ line.product.emoji }}</span>
          <div class="cart-item__info">
            <span class="cart-item__name">{{ line.product.name }}</span>
            <span v-if="line.choices.length" class="cart-item__choices">{{ line.choices.map((c) => c.name).join(' · ') }}</span>
            <span v-if="line.note" class="cart-item__note">“{{ line.note }}”</span>
            <span v-if="!line.orderable" class="cart-item__off">Esgotou agora — não será enviado</span>
            <span v-else class="cart-item__price money">{{ formatMoney(line.unitPrice * line.quantity) }}</span>
          </div>
          <QtyStepper
            size="sm"
            removable
            :model-value="line.quantity"
            @update:model-value="(q) => cart.setQty(line.id, q)"
          />
        </li>
      </ul>

      <RouterLink :to="{ name: 'menu' }" class="cart__more">+ Adicionar mais itens</RouterLink>

      <div class="cart__block">
        <DestinationPicker v-model="destination" :tables="settings.tables" />
      </div>

      <section class="cart__block">
        <label for="order-note" class="cart__label">Observação para a cozinha</label>
        <textarea
          id="order-note"
          v-model="note"
          rows="2"
          maxlength="140"
          class="cart__note"
          placeholder="Ex.: pode trazer tudo junto"
        />
      </section>

      <section class="cart__block summary">
        <div class="summary__row">
          <span>Itens desta sacola</span>
          <span class="money">{{ formatMoney(cart.total) }}</span>
        </div>
        <div v-if="alreadyOrdered" class="summary__row summary__row--muted">
          <span>Já na comanda</span>
          <span class="money">{{ formatMoney(alreadyOrdered) }}</span>
        </div>
        <div class="summary__row summary__row--total">
          <span>Total da comanda</span>
          <span class="money">{{ formatMoney(cart.total + alreadyOrdered) }}</span>
        </div>
        <p class="summary__pay">
          Nada é cobrado agora. Você paga no caixa ao sair, apresentando a comanda {{ customer.session?.number }}.
        </p>
      </section>

      <div class="cart__footer">
        <p v-if="!destination" class="cart__need">Escolha onde você está para enviar</p>
        <AppButton size="xl" full-width :disabled="!destination || !orderableCount" :loading="sending" @click="send">
          Enviar para a cozinha · {{ formatMoney(cart.total) }}
        </AppButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Destination } from '@/types'
import { useCartStore }     from '@/stores/useCartStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useToastStore }    from '@/stores/useToastStore'
import { formatMoney, formatOrderNumber } from '@/lib/format'
import ComandaChip       from '@/components/customer/ComandaChip.vue'
import DestinationPicker from '@/components/customer/DestinationPicker.vue'
import AppButton  from '@/components/ui/AppButton.vue'
import QtyStepper from '@/components/ui/QtyStepper.vue'

const cart     = useCartStore()
const orders   = useOrderStore()
const customer = useCustomerStore()
const comandas = useComandasStore()
const settings = useSettingsStore().settings
const toast    = useToastStore()
const router   = useRouter()

const note        = ref('')
const sending     = ref(false)
// Lembra o último local da comanda (o cliente costuma continuar na mesma mesa)
const destination = ref<Destination | null>(customer.session?.destination ?? null)

const orderableCount = computed(() => cart.lines.filter((l) => l.orderable).length)
const alreadyOrdered = computed(() => (customer.sessionId ? orders.comandaSubtotal(customer.sessionId) : 0))

async function send() {
  const session = customer.session
  if (!session || !destination.value || !orderableCount.value) return
  sending.value = true
  try {
    comandas.setDestination(session.id, destination.value)
    const order = await orders.place(session, cart.toOrderItems(), destination.value, { note: note.value })
    cart.items = cart.items.filter((i) => !cart.lines.find((l) => l.id === i.id)?.orderable)
    note.value = ''
    navigator.vibrate?.([30, 50, 30])
    toast.add(`Pedido ${formatOrderNumber(order.number)} enviado para a cozinha!`, 'success')
    router.push({ name: 'orders', query: { novo: order.id } })
  } catch {
    toast.add('Não foi possível enviar. Tente de novo.', 'error')
  } finally {
    sending.value = false
  }
}
</script>

<style lang="scss" scoped>
.cart {
  padding-bottom: calc(var(--bottomnav-height) + var(--safe-bottom));

  &__empty {
    padding: 64px var(--spacing-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
    span { font-size: 3rem; }
    h2   { font-family: var(--font-display); }
    p    { color: var(--color-text-muted); margin-bottom: var(--spacing-md); }
  }

  &__items { background: var(--color-surface); border-block: 1px solid var(--color-border); }

  &__more {
    display: block;
    padding: var(--spacing-md);
    color: var(--color-accent-text);
    font-weight: 600;
    font-size: 0.9375rem;
    text-align: center;
  }

  &__block { margin: 0 var(--spacing-md) var(--spacing-lg); }

  &__label {
    display: block;
    font-size: 0.9375rem;
    font-weight: 600;
    margin-bottom: var(--spacing-sm);
  }

  &__note {
    width: 100%;
    resize: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 1rem;
    &:focus { outline: none; border-color: var(--color-primary); }
  }

  // sticky: fica logo após o resumo e só gruda acima da navegação quando a lista é longa
  &__footer {
    position: sticky;
    bottom: calc(var(--bottomnav-height) + var(--safe-bottom));
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
    background: linear-gradient(to top, var(--color-bg) 75%, transparent);
    z-index: 30;
  }

  &__need { text-align: center; font-size: 0.8125rem; color: var(--color-accent-text); margin-bottom: 6px; }
}

.cart-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  &:last-child { border-bottom: none; }

  &--off &__emoji, &--off &__name { opacity: 0.45; }

  &__emoji {
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    font-size: 1.75rem;
    @include flex-center;
  }

  &__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  &__name { font-weight: 600; }
  &__choices, &__note { font-size: 0.8125rem; color: var(--color-text-muted); }
  &__note { font-style: italic; }
  &__price { font-size: 0.9375rem; margin-top: 2px; }
  &__off { font-size: 0.8125rem; color: var(--color-danger); font-weight: 500; }
}

.summary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &__row {
    @include flex-between;
    font-size: 0.9375rem;
    &--muted { color: var(--color-text-muted); }
    &--total {
      padding-top: var(--spacing-sm);
      border-top: 1px solid var(--color-border);
      font-weight: 600;
      font-size: 1.0625rem;
    }
  }

  &__pay {
    margin-top: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
}
</style>
