import type {
  CashierSession, CashMovement, ComandaSession, Destination, Insumo, Order, OrderStatus,
  Payment, PaymentMethod, Product, SimpleMethod, StockMove,
} from '@/types'
import { indexInsumos } from '@/lib/recipe'
import { newId } from '@/lib/ids'
import { buildItem, choicesFor, orderSubtotal } from './build'

// "Hoje" da loja: caixa aberto, comandas pagas, comandas abertas com pedidos em
// todos os estados (inclusive atrasados), para cozinha, salão e admin nascerem vivos.
// Os horários são relativos ao momento em que o seed é criado.

export interface LiveSeed {
  comandas:        ComandaSession[]
  orders:          Order[]
  cashierSessions: CashierSession[]
  movements:       CashMovement[]
  stockMoves:      StockMove[]
}

type Line = [productId: string, qty: number, choiceIds?: string[], note?: string]

interface OrderSpec {
  at: number                       // minutos atrás
  status: OrderStatus
  started?: number
  ready?: number
  delivered?: number
  lines: Line[]
  note?: string
}

interface ComandaSpec {
  number: string
  name?: string
  dest: Destination
  opened: number
  closed?: number
  method?: PaymentMethod
  orders: OrderSpec[]
}

const mesa = (table: number): Destination => ({ type: 'mesa', table })

const closedToday: ComandaSpec[] = [
  { number: '031', dest: mesa(3), opened: 280, closed: 250, method: 'pix',
    orders: [{ at: 276, status: 'delivered', started: 274, ready: 270, delivered: 268, lines: [['media', 1], ['p-chapa', 1, ['queijo']]] }] },
  { number: '112', dest: { type: 'balcao' }, opened: 262, closed: 228, method: 'credito',
    orders: [{ at: 258, status: 'delivered', started: 257, ready: 250, delivered: 249, lines: [['pao-queijo', 1], ['expresso', 2]] }] },
  { number: '066', name: 'Carlos', dest: mesa(7), opened: 232, closed: 190, method: 'debito',
    orders: [{ at: 228, status: 'delivered', started: 226, ready: 218, delivered: 216, lines: [['ovos', 1], ['suco-lar', 1, ['g']], ['cappu', 1, ['p', 'integral']]] }] },
  { number: '009', dest: { type: 'viagem' }, opened: 204, closed: 196, method: 'dinheiro',
    orders: [{ at: 203, status: 'delivered', started: 203, ready: 200, delivered: 199, lines: [['frances', 6], ['bolo-fuba', 1]] }] },
  { number: '140', dest: mesa(11), opened: 150, closed: 95, method: 'voucher',
    orders: [{ at: 146, status: 'delivered', started: 144, ready: 131, delivered: 129, lines: [['pf', 2], ['refri', 2]] }] },
  { number: '072', name: 'Lia', dest: mesa(5), opened: 124, closed: 70, method: 'misto',
    orders: [{ at: 120, status: 'delivered', started: 118, ready: 104, delivered: 102, lines: [['contra', 1, ['ponto']], ['salada', 1], ['agua', 1, ['com']]] }] },
]

const openNow: ComandaSpec[] = [
  { number: '017', name: 'Ana', dest: mesa(4), opened: 66, orders: [
    { at: 62, status: 'delivered', started: 61, ready: 57, delivered: 55, lines: [['pingado', 1, ['integral']], ['sonho', 1]] },
    { at: 9, status: 'preparing', started: 6, lines: [['misto', 1, ['bacon']]] },
  ] },
  { number: '088', dest: mesa(9), opened: 5, orders: [
    { at: 3, status: 'received', lines: [['omelete', 1, [], 'Sem cebolinha'], ['suco-lar', 1, ['g']]], note: 'Sem pressa, estamos conversando' },
  ] },
  { number: '121', name: 'Pedro', dest: { type: 'balcao' }, opened: 16, orders: [
    { at: 14, status: 'ready', started: 12, ready: 2, lines: [['pao-queijo', 1], ['cappu', 1, ['p', 'integral']]] },
  ] },
  { number: '054', dest: mesa(2), opened: 22, orders: [
    { at: 17, status: 'preparing', started: 12, lines: [['contra', 1, ['bem']], ['pf', 1]] },
  ] },
  { number: '203', dest: { type: 'viagem' }, opened: 8, orders: [
    { at: 6, status: 'preparing', started: 4, lines: [['x-egg', 2, ['firme']]] },
  ] },
  { number: '077', name: 'Bia e Léo', dest: mesa(12), opened: 42, orders: [
    { at: 38, status: 'delivered', started: 36, ready: 24, delivered: 22, lines: [['pf', 1], ['salada', 1], ['refri', 2]] },
  ] },
  { number: '145', name: 'Júlia', dest: mesa(6), opened: 13, orders: [
    { at: 11, status: 'ready', started: 10, ready: 5, lines: [['ovos', 1, ['queijo']], ['media', 1, ['desnat']]] },
  ] },
  { number: '190', dest: mesa(14), opened: 2, orders: [
    { at: 1, status: 'received', lines: [['bauru', 1], ['agua', 1, ['sem']]] },
  ] },
]

const ago = (now: number, min: number) => new Date(now - min * 60_000).toISOString()

function nfceKey(n: number): string {
  // 44 dígitos fictícios, estáveis por número
  return ('3526091234567800019065001' + String(n).padStart(9, '0') + '1' + '123456789').slice(0, 44)
}

export function buildLiveSeed(products: Product[], insumosList: Insumo[]): LiveSeed {
  const now      = Date.now()
  const insumos  = indexInsumos(insumosList)
  const byId     = new Map(products.map((p) => [p.id, p]))
  const cashier: CashierSession = {
    id: newId(), operator: 'Marta', openedAt: ago(now, 300), openingBalance: 20000,
  }

  const comandas: ComandaSession[] = []
  const orders:   Order[] = []
  let nfceNumber = 0

  for (const spec of [...closedToday, ...openNow]) {
    const session: ComandaSession = {
      id: newId(),
      number: spec.number,
      status: spec.closed ? 'closed' : 'open',
      origin: 'cliente',
      customerName: spec.name,
      destination: spec.dest,
      openedAt: ago(now, spec.opened),
      closedAt: spec.closed ? ago(now, spec.closed) : undefined,
    }

    for (const o of spec.orders) {
      orders.push({
        id: newId(),
        number: 0,
        comandaId: session.id,
        comandaNumber: session.number,
        customerName: spec.name,
        destination: spec.dest,
        origin: 'cliente',
        note: o.note,
        status: o.status,
        createdAt:   ago(now, o.at),
        startedAt:   o.started   !== undefined ? ago(now, o.started)   : undefined,
        readyAt:     o.ready     !== undefined ? ago(now, o.ready)     : undefined,
        deliveredAt: o.delivered !== undefined ? ago(now, o.delivered) : undefined,
        deliveredBy: o.delivered !== undefined ? 'salao' : undefined,
        items: o.lines.map(([pid, qty, choiceIds, note]) => {
          const p = byId.get(pid)!
          return buildItem(p, qty, insumos, choicesFor(p, choiceIds), note)
        }),
      })
    }

    if (spec.closed && spec.method) {
      const subtotal = orders.filter((o) => o.comandaId === session.id).reduce((s, o) => s + orderSubtotal(o), 0)
      const payment: Payment = {
        subtotal, discount: 0, serviceFee: 0, total: subtotal,
        method: spec.method,
        paidAt: session.closedAt!,
        operator: cashier.operator,
        cashierSessionId: cashier.id,
        nfce: { number: ++nfceNumber, series: 1, key: nfceKey(nfceNumber), issuedAt: session.closedAt! },
      }
      if (spec.method === 'dinheiro') {
        payment.received = Math.ceil(subtotal / 1000) * 1000
        payment.change   = payment.received - subtotal
      }
      if (spec.method === 'misto') {
        const pix = Math.round(subtotal / 2)
        payment.parts = [
          { method: 'pix' as SimpleMethod, amount: pix },
          { method: 'credito' as SimpleMethod, amount: subtotal - pix },
        ]
      }
      session.payment = payment
    }
    comandas.push(session)
  }

  // Senhas do dia em ordem de chegada
  orders
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((o, i) => { o.number = i + 1 })

  const movements: CashMovement[] = [
    { id: newId(), sessionId: cashier.id, type: 'suprimento', amount: 5000,  reason: 'Troco extra em moedas', createdAt: ago(now, 240), operator: 'Marta' },
    { id: newId(), sessionId: cashier.id, type: 'sangria',    amount: 15000, reason: 'Depósito no cofre',     createdAt: ago(now, 60),  operator: 'Gestão' },
  ]

  const insumoName = (id: string) => insumosList.find((i) => i.id === id)?.name ?? id
  const stockMoves: StockMove[] = [
    { id: newId(), insumoId: 'i-frances', insumoName: insumoName('i-frances'), type: 'producao', qty: 240, createdAt: ago(now, 330), operator: 'Rita', note: 'Fornada da manhã' },
    { id: newId(), insumoId: 'i-massa-pq', insumoName: insumoName('i-massa-pq'), type: 'producao', qty: 4, createdAt: ago(now, 320), operator: 'Rita' },
    { id: newId(), insumoId: 'i-leite', insumoName: insumoName('i-leite'), type: 'compra', qty: 24, unitCost: 540, supplier: 'Laticínios Serra', createdAt: ago(now, 1500), operator: 'Gestão', note: 'NF 18.442' },
    { id: newId(), insumoId: 'i-ovo', insumoName: insumoName('i-ovo'), type: 'compra', qty: 180, unitCost: 72, supplier: 'Granja Vista Alegre', createdAt: ago(now, 1560), operator: 'Gestão' },
    { id: newId(), insumoId: 'i-tomate', insumoName: insumoName('i-tomate'), type: 'perda', qty: -0.8, createdAt: ago(now, 1440), operator: 'Rita', note: 'Passou do ponto' },
    { id: newId(), insumoId: 'i-cafe', insumoName: insumoName('i-cafe'), type: 'compra', qty: 5, unitCost: 7800, supplier: 'Torrefação Mantiqueira', createdAt: ago(now, 2900), operator: 'Gestão', note: 'NF 7.019' },
  ]

  return { comandas, orders, cashierSessions: [cashier], movements, stockMoves }
}
