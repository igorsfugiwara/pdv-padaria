<template>
  <button class="comanda-chip" @click="showSheet = true" aria-label="Opções da comanda">
    <span class="comanda-chip__label">Comanda</span>
    <span class="comanda-chip__number">{{ customer.session?.number }}</span>
  </button>

  <AppSheet v-model="showSheet" :title="`Comanda ${customer.session?.number}`">
    <div class="comanda-info">
      <label class="field">
        <span class="field__label">Como podemos te chamar? (opcional)</span>
        <input v-model="name" class="input" maxlength="30" placeholder="Seu primeiro nome" @change="customer.setName(name)" />
      </label>

      <div class="comanda-info__row">
        <span>Consumido até agora</span>
        <strong class="money">{{ formatMoney(consumed) }}</strong>
      </div>
      <p>Tudo o que você pedir fica nesta comanda. Na saída, apresente-a no caixa para pagar.</p>
      <p v-if="cart.count" class="comanda-info__warn">
        Você tem {{ cart.count }} {{ cart.count === 1 ? 'item' : 'itens' }} na sacola que ainda não {{ cart.count === 1 ? 'foi enviado' : 'foram enviados' }} para a cozinha.
      </p>
    </div>
    <template #footer>
      <AppButton variant="outline" full-width size="lg" @click="swap">Trocar comanda</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useCartStore }     from '@/stores/useCartStore'
import { formatMoney } from '@/lib/format'
import AppSheet  from '@/components/ui/AppSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'

const customer = useCustomerStore()
const orders   = useOrderStore()
const cart     = useCartStore()
const router   = useRouter()

const showSheet = ref(false)
const name      = ref(customer.session?.customerName ?? '')
watch(showSheet, (open) => { if (open) name.value = customer.session?.customerName ?? '' })

const consumed = computed(() => (customer.sessionId ? orders.comandaSubtotal(customer.sessionId) : 0))

function swap() {
  showSheet.value = false
  customer.release()
  router.replace({ name: 'scan' })
}
</script>

<style lang="scss" scoped>
.comanda-chip {
  @include button-reset;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary);
  background: var(--color-surface);

  &__label  { font-size: 0.5625rem; text-transform: uppercase; letter-spacing: 0.16em; color: var(--color-accent-text); font-weight: 600; }
  &__number { font-family: var(--font-mono); font-size: 1.125rem; font-weight: 500; color: var(--color-text); }
}

.comanda-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  color: var(--color-text-muted);
  font-size: 0.9375rem;

  .input { background: var(--color-surface); }

  &__row {
    @include flex-between;
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    color: var(--color-text);
    strong { font-size: 1.125rem; }
  }

  &__warn {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-warning-soft);
    color: var(--color-text);
    font-size: 0.875rem;
  }
}
</style>
