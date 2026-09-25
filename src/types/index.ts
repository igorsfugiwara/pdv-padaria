// ─── Loja (multi-estabelecimento) ────────────────────────────────────────────

export interface Tenant {
  slug: string          // usado na URL: /cortico/...
  name: string
  tagline: string
  logoEmoji: string
  city: string
  cnpj: string          // fictício no mock, usado na NFC-e simulada
}

// ─── Fiscal (NFC-e modelo 65) ────────────────────────────────────────────────

export type FiscalAmbiente = 'simulado' | 'homologacao' | 'producao'
export type FiscalProviderId = 'simulado' | 'focusnfe'

export interface FiscalConfig {
  provider: FiscalProviderId
  ambiente: FiscalAmbiente         // 'simulado' só com provider 'simulado'
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  crt: 1 | 3                       // 1 = Simples Nacional (CSOSN) · 3 = Regime normal (CST)
  endereco: {
    logradouro: string
    numero: string
    bairro: string
    municipio: string
    codigoMunicipio: string        // IBGE, 7 dígitos
    uf: string
    cep: string
  }
  serie: number
  cancelamentoMinutos: number      // prazo legal de cancelamento (SP: 30)
  contingenciaHoras: number        // prazo para transmitir nota em contingência (24)
  taxaServicoNaNota: boolean       // taxa de serviço entra como "outras despesas"
  informacoesAdicionais?: string
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
  fiscal: FiscalConfig
}

// ─── Equipe ──────────────────────────────────────────────────────────────────

export type Role = 'cozinha' | 'salao' | 'caixa' | 'gerente'

export interface StaffUser {
  id: string
  name: string
  role: Role
  pin?: string          // só no modo mock; no Firestore o PIN fica em staffPins (ilegível)
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

// Tributação do produto. Quem define é o contador: `revisado` marca o que ele conferiu.
export interface ProductFiscal {
  ncm: string                      // 8 dígitos
  cest?: string                    // 7 dígitos, quando há substituição tributária
  cfop: string                     // 5101 produção própria · 5102 revenda · 5405 revenda com ST
  origem: string                   // 0 nacional … 8
  csosn?: string                   // CRT 1: 102, 103, 300, 400, 500, 900
  cstIcms?: string                 // CRT 3: 00, 20, 40, 41, 60…
  aliquotaIcms?: number            // CRT 3, em %
  unidade: 'UN' | 'KG' | 'L'
  gtin?: string                    // código de barras; sem ele vai "SEM GTIN"
  cstPisCofins?: string            // quando o contador pedir (senão, o padrão do provedor)
  ibsCbsCst?: string               // reforma tributária (IBS/CBS), quando obrigatório
  ibsCbsClassTrib?: string
  revisado: boolean
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
  stockOut?: boolean     // sem insumo para a receita base; mantido pela equipe (o cliente não lê o estoque)
  fiscal?: ProductFiscal
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
  consumedAt?: string    // quando a ficha técnica baixou os insumos (ao iniciar o preparo)
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'voucher' | 'misto'
export type SimpleMethod = Exclude<PaymentMethod, 'misto'>

// Resumo da nota guardado no pagamento da comanda (o documento completo fica em `nfce`)
export interface Nfce {
  ref?: string           // id do documento fiscal (= referência no provedor)
  status?: NfceStatus
  ambiente?: FiscalAmbiente
  number: number
  series: number
  key: string            // chave de acesso (44 dígitos)
  issuedAt: string
}

export type NfceStatus = 'pendente' | 'autorizada' | 'rejeitada' | 'cancelada' | 'contingencia'

export interface NfceDoc {
  id: string             // referência única no provedor
  comandaId: string
  comandaNumber: string
  status: NfceStatus
  provider: FiscalProviderId
  ambiente: FiscalAmbiente
  total: number          // centavos
  cpf?: string
  numero?: number
  serie?: number
  chave?: string
  protocolo?: string
  mensagem?: string      // motivo da rejeição ou retorno da SEFAZ
  codigoSefaz?: string
  qrcodeUrl?: string
  urlConsulta?: string
  danfeUrl?: string
  xmlUrl?: string
  criadaEm: string
  autorizadaEm?: string
  tentativas: number
  operador: string
  cancelamento?: { em: string; justificativa: string; por: string; protocolo?: string }
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
  orderIds?: string[]    // pedidos da comanda (o cliente assina cada um pelo id)
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
