// ─── Loja (multi-estabelecimento) ────────────────────────────────────────────

export interface Tenant {
  slug: string          // usado na URL: /cortico/...
  name: string
  tagline: string
  logoEmoji: string
  city: string
  cnpj: string          // fictício no mock, usado na NFC-e simulada
}

export interface Settings {
  staffTheme: 'escuro' | 'claro'
  warnMinutes: number        // salão/cozinha: card fica em atenção a partir daqui
  lateMinutes: number        // e atrasado a partir daqui
  serviceFeePercent: number  // 0 = sem taxa de serviço
  tables: number
  comandaMin: number
  comandaMax: number
  blockedComandas: string[]  // cartões perdidos ou danificados
  nfceSeries: number
}

// ─── Equipe ──────────────────────────────────────────────────────────────────

export type Role = 'cozinha' | 'salao' | 'caixa' | 'gerente'

export interface StaffUser {
  id: string
  name: string
  role: Role
  pin: string
}

// ─── Cardápio e ficha técnica ───────────────────────────────────────────────

export type Station = 'cozinha' | 'cafe' | 'balcao'
export type Unit = 'kg' | 'l' | 'un'

export interface Insumo {
  id: string
  name: string
  unit: Unit
  stock: number          // na unidade do insumo (0,25 kg, 3 un…)
  minStock: number
  avgCost: number        // centavos por unidade (custo médio ponderado)
  produced?: boolean     // feito na casa (pão, massa, bolo): entra por produção, não por compra
  supplier?: string
}

export interface RecipeLine {
  insumoId: string
  qty: number            // na unidade do insumo
}

export interface OptionChoice {
  id: string
  name: string
  price: number          // centavos, acréscimo sobre o preço base
  recipe?: RecipeLine[]  // o que o adicional consome
}

export interface OptionGroup {
  id: string
  name: string
  required: boolean
  max: number            // 1 = escolha única, >1 = múltipla
  choices: OptionChoice[]
}

export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number          // centavos
  categoryId: string
  emoji: string          // placeholder de foto nos dados mockados
  station: Station
  available: boolean     // false = esgotado agora (continua no cardápio)
  active: boolean        // false = fora do cardápio
  tags?: string[]
  options?: OptionGroup[]
  recipe: RecipeLine[]
}

// ─── Comanda, pedido e pagamento ─────────────────────────────────────────────

export interface Destination {
  type: 'mesa' | 'balcao' | 'viagem'
  table?: number
}

export interface SelectedChoice {
  groupId: string
  groupName: string
  choiceId: string
  name: string
  price: number
}

export interface CartItem {
  id: string
  productId: string
  quantity: number
  choices: SelectedChoice[]
  note?: string
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  categoryId: string
  emoji: string
  station: Station
  unitPrice: number      // centavos, com adicionais (snapshot)
  unitCost: number       // custo da ficha técnica no momento da venda (snapshot, para CMV)
  quantity: number
  choices: SelectedChoice[]
  note?: string
  cancelled?: { at: string; by: string; reason: string }
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivered'

export interface Order {
  id: string
  number: number         // senha do dia
  comandaId: string
  comandaNumber: string
  customerName?: string
  destination: Destination
  origin: 'cliente' | 'caixa'
  items: OrderItem[]
  note?: string
  status: OrderStatus
  createdAt: string
  startedAt?: string
  readyAt?: string
  deliveredAt?: string
  deliveredBy?: Role
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'voucher' | 'misto'
export type SimpleMethod = Exclude<PaymentMethod, 'misto'>

export interface Nfce {
  number: number
  series: number
  key: string            // chave de acesso fictícia (44 dígitos)
  issuedAt: string
}

export interface Payment {
  subtotal: number
  discount: number
  serviceFee: number
  total: number
  method: PaymentMethod
  parts?: { method: SimpleMethod; amount: number }[]
  received?: number      // dinheiro entregue pelo cliente
  change?: number
  paidAt: string
  operator: string
  cashierSessionId: string
  nfce?: Nfce
}

export interface ComandaSession {
  id: string
  number: string         // "042" (cartão físico) ou "V03" (venda direta no caixa)
  status: 'open' | 'closed' | 'cancelled'
  origin: 'cliente' | 'caixa'
  customerName?: string
  destination?: Destination
  openedAt: string
  closedAt?: string
  payment?: Payment
}

// ─── Caixa e estoque ─────────────────────────────────────────────────────────

export interface CashierSession {
  id: string
  operator: string
  openedAt: string
  closedAt?: string
  openingBalance: number
  countedCash?: number
  notes?: string
}

export interface CashMovement {
  id: string
  sessionId: string
  type: 'sangria' | 'suprimento'
  amount: number
  reason: string
  createdAt: string
  operator: string
}

export interface StockMove {
  id: string
  insumoId: string
  insumoName: string
  type: 'compra' | 'producao' | 'ajuste' | 'perda'
  qty: number            // positivo entra, negativo sai
  unitCost?: number
  supplier?: string
  note?: string
  createdAt: string
  operator: string
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
