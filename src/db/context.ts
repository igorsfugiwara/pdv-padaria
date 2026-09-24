import { reactive } from 'vue'
import type { Role } from '@/types'

// Quem é este aparelho agora. Decide o que cada coleção assina no Firestore:
// a equipe vê a operação inteira; o cliente, só a própria comanda e pedidos.
export const dbContext = reactive({
  staffRole: null as Role | null,
  customerSessionId: null as string | null,
  customerOrderIds: [] as string[],
})

export const isStaffScope = () => dbContext.staffRole !== null
