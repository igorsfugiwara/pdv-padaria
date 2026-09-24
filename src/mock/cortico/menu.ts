import type { Category, OptionGroup, Product } from '@/types'

// Cardápio do Cortiço com ficha técnica. As quantidades da receita estão na
// unidade do insumo (kg, l, un): 0,03 kg = 30 g.

export const categories: Category[] = [
  { id: 'chapa',    name: 'Na chapa' },
  { id: 'pratos',   name: 'Pratos' },
  { id: 'paes',     name: 'Pães' },
  { id: 'salgados', name: 'Salgados' },
  { id: 'doces',    name: 'Doces e bolos' },
  { id: 'cafes',    name: 'Cafés' },
  { id: 'bebidas',  name: 'Bebidas' },
]

const adicionaisChapa: OptionGroup = {
  id: 'adic', name: 'Adicionais', required: false, max: 3,
  choices: [
    { id: 'queijo',    name: 'Queijo prato', price: 300, recipe: [{ insumoId: 'i-q-prato',   qty: 0.03 }] },
    { id: 'presunto',  name: 'Presunto',     price: 300, recipe: [{ insumoId: 'i-presunto',  qty: 0.03 }] },
    { id: 'bacon',     name: 'Bacon',        price: 450, recipe: [{ insumoId: 'i-bacon',     qty: 0.03 }] },
    { id: 'requeijao', name: 'Requeijão',    price: 250, recipe: [{ insumoId: 'i-requeijao', qty: 0.025 }] },
  ],
}

const pontoOvo: OptionGroup = {
  id: 'ponto', name: 'Ponto do ovo', required: true, max: 1,
  choices: [
    { id: 'mole',  name: 'Gema mole',  price: 0 },
    { id: 'firme', name: 'Gema firme', price: 0 },
  ],
}

const pontoCarne: OptionGroup = {
  id: 'ponto-carne', name: 'Ponto da carne', required: true, max: 1,
  choices: [
    { id: 'mal',   name: 'Malpassado', price: 0 },
    { id: 'ponto', name: 'Ao ponto',   price: 0 },
    { id: 'bem',   name: 'Bem passado', price: 0 },
  ],
}

function leite(qty: number): OptionGroup {
  return {
    id: 'leite', name: 'Leite', required: true, max: 1,
    choices: [
      { id: 'integral', name: 'Integral',        price: 0,   recipe: [{ insumoId: 'i-leite',      qty }] },
      { id: 'desnat',   name: 'Desnatado',       price: 0,   recipe: [{ insumoId: 'i-leite-desn', qty }] },
      { id: 'vegetal',  name: 'Vegetal (aveia)', price: 200, recipe: [{ insumoId: 'i-aveia',      qty }] },
    ],
  }
}

function tamanho(extra: { insumoId: string; qty: number }[]): OptionGroup {
  return {
    id: 'tam', name: 'Tamanho', required: true, max: 1,
    choices: [
      { id: 'p', name: 'Pequeno (180 ml)', price: 0 },
      { id: 'g', name: 'Grande (300 ml)',  price: 300, recipe: extra },
    ],
  }
}

type Seed = Omit<Product, 'available' | 'active'> & { available?: boolean }

const seed: Seed[] = [
  // Na chapa
  { id: 'p-chapa', categoryId: 'chapa', station: 'cozinha', emoji: '🥖', name: 'Pão na chapa', price: 650, tags: ['Mais pedido'],
    description: 'Pão francês na manteiga, crocante por fora e macio por dentro.',
    options: [adicionaisChapa],
    recipe: [{ insumoId: 'i-frances', qty: 1 }, { insumoId: 'i-manteiga', qty: 0.015 }] },
  { id: 'misto', categoryId: 'chapa', station: 'cozinha', emoji: '🥪', name: 'Misto quente', price: 1400,
    description: 'Pão de forma, presunto e queijo prato dourados na chapa.',
    options: [adicionaisChapa],
    recipe: [{ insumoId: 'i-forma', qty: 2 }, { insumoId: 'i-presunto', qty: 0.04 }, { insumoId: 'i-q-prato', qty: 0.04 }, { insumoId: 'i-manteiga', qty: 0.01 }] },
  { id: 'bauru', categoryId: 'chapa', station: 'cozinha', emoji: '🥪', name: 'Bauru', price: 2400,
    description: 'Pão francês, rosbife, muçarela derretida, tomate e orégano.',
    recipe: [{ insumoId: 'i-frances', qty: 1 }, { insumoId: 'i-rosbife', qty: 0.08 }, { insumoId: 'i-mussarela', qty: 0.06 }, { insumoId: 'i-tomate', qty: 0.04 }] },
  { id: 'ovos', categoryId: 'chapa', station: 'cozinha', emoji: '🍳', name: 'Ovos mexidos', price: 1800,
    description: 'Três ovos cremosos na manteiga com torradas.',
    options: [adicionaisChapa],
    recipe: [{ insumoId: 'i-ovo', qty: 3 }, { insumoId: 'i-manteiga', qty: 0.015 }, { insumoId: 'i-forma', qty: 2 }] },
  { id: 'omelete', categoryId: 'chapa', station: 'cozinha', emoji: '🍳', name: 'Omelete da casa', price: 2600,
    description: 'Queijo prato, tomate e cebolinha, com salada de folhas.',
    recipe: [{ insumoId: 'i-ovo', qty: 3 }, { insumoId: 'i-q-prato', qty: 0.04 }, { insumoId: 'i-tomate', qty: 0.05 }, { insumoId: 'i-folhas', qty: 0.04 }] },
  { id: 'x-egg', categoryId: 'chapa', station: 'cozinha', emoji: '🍔', name: 'X-Egg', price: 2900,
    description: 'Hambúrguer de 120 g, queijo e ovo no pão da casa.',
    options: [pontoOvo, adicionaisChapa],
    recipe: [{ insumoId: 'i-hamburguer', qty: 1 }, { insumoId: 'i-hamb-120', qty: 1 }, { insumoId: 'i-q-prato', qty: 0.03 }, { insumoId: 'i-ovo', qty: 1 }] },

  // Pratos
  { id: 'pf', categoryId: 'pratos', station: 'cozinha', emoji: '🍛', name: 'Prato do dia', price: 3900, tags: ['Almoço'],
    description: 'Arroz, feijão, filé de frango grelhado, batata sauté e salada.',
    recipe: [{ insumoId: 'i-arroz', qty: 0.15 }, { insumoId: 'i-feijao', qty: 0.12 }, { insumoId: 'i-frango', qty: 0.18 }, { insumoId: 'i-batata', qty: 0.12 }, { insumoId: 'i-folhas', qty: 0.03 }] },
  { id: 'contra', categoryId: 'pratos', station: 'cozinha', emoji: '🥩', name: 'Contrafilé acebolado', price: 5200,
    description: 'Contrafilé de 220 g, arroz, feijão e fritas.',
    options: [pontoCarne],
    recipe: [{ insumoId: 'i-contra', qty: 0.22 }, { insumoId: 'i-arroz', qty: 0.15 }, { insumoId: 'i-feijao', qty: 0.12 }, { insumoId: 'i-batata', qty: 0.15 }] },
  { id: 'salada', categoryId: 'pratos', station: 'cozinha', emoji: '🥗', name: 'Salada Cortiço', price: 3200,
    description: 'Folhas, tomate confit, frango grelhado e molho da casa.',
    recipe: [{ insumoId: 'i-folhas', qty: 0.12 }, { insumoId: 'i-tomate', qty: 0.08 }, { insumoId: 'i-frango', qty: 0.12 }] },

  // Pães
  { id: 'frances', categoryId: 'paes', station: 'balcao', emoji: '🥖', name: 'Pão francês (un.)', price: 90,
    description: 'Saído do forno a cada hora.',
    recipe: [{ insumoId: 'i-frances', qty: 1 }] },
  { id: 'pao-queijo', categoryId: 'paes', station: 'cozinha', emoji: '🧀', name: 'Pão de queijo', price: 1200, tags: ['Mais pedido'],
    description: 'Porção com 6 unidades, quentinho.',
    recipe: [{ insumoId: 'i-massa-pq', qty: 0.18 }] },
  { id: 'croissant', categoryId: 'paes', station: 'balcao', emoji: '🥐', name: 'Croissant', price: 1100,
    description: 'Massa folhada amanteigada.',
    options: [{ id: 'rech', name: 'Recheio', required: true, max: 1, choices: [
      { id: 'puro', name: 'Tradicional', price: 0 },
      { id: 'pq',   name: 'Presunto e queijo', price: 500, recipe: [{ insumoId: 'i-presunto', qty: 0.03 }, { insumoId: 'i-q-prato', qty: 0.03 }] },
      { id: 'choc', name: 'Chocolate', price: 400, recipe: [{ insumoId: 'i-chocolate', qty: 0.03 }] },
    ] }],
    recipe: [{ insumoId: 'i-croissant', qty: 1 }] },
  { id: 'italiano', categoryId: 'paes', station: 'balcao', emoji: '🍞', name: 'Pão italiano', price: 1900, available: false,
    description: 'Fermentação natural, 500 g.',
    recipe: [{ insumoId: 'i-italiano', qty: 1 }] },

  // Salgados
  { id: 'coxinha', categoryId: 'salgados', station: 'balcao', emoji: '🍗', name: 'Coxinha', price: 900,
    description: 'Frango com requeijão cremoso.', recipe: [{ insumoId: 'i-coxinha', qty: 1 }] },
  { id: 'esfiha', categoryId: 'salgados', station: 'balcao', emoji: '🥟', name: 'Esfiha de carne', price: 800,
    description: 'Aberta, com limão à parte.', recipe: [{ insumoId: 'i-esfiha', qty: 1 }] },
  { id: 'empada', categoryId: 'salgados', station: 'balcao', emoji: '🥧', name: 'Empada de palmito', price: 950,
    description: 'Massa podre que desmancha.', recipe: [{ insumoId: 'i-empada', qty: 1 }] },
  { id: 'quiche', categoryId: 'salgados', station: 'cozinha', emoji: '🥧', name: 'Quiche de alho-poró', price: 1600,
    description: 'Fatia servida quente.', recipe: [{ insumoId: 'i-quiche', qty: 1 }] },

  // Doces e bolos
  { id: 'sonho', categoryId: 'doces', station: 'balcao', emoji: '🍩', name: 'Sonho', price: 850,
    description: 'Recheado com creme de baunilha.', recipe: [{ insumoId: 'i-sonho', qty: 1 }] },
  { id: 'bolo-fuba', categoryId: 'doces', station: 'balcao', emoji: '🍰', name: 'Bolo de fubá (fatia)', price: 900,
    description: 'Com goiabada cascão.', recipe: [{ insumoId: 'i-bolo-fuba', qty: 1 }] },
  { id: 'bolo-cen', categoryId: 'doces', station: 'balcao', emoji: '🍫', name: 'Bolo de cenoura (fatia)', price: 1000, tags: ['Novo'],
    description: 'Cobertura de chocolate meio amargo.', recipe: [{ insumoId: 'i-bolo-cen', qty: 1 }] },
  { id: 'pudim', categoryId: 'doces', station: 'balcao', emoji: '🍮', name: 'Pudim de leite', price: 1200,
    description: 'Fatia generosa com calda de caramelo.', recipe: [{ insumoId: 'i-pudim', qty: 1 }] },

  // Cafés
  { id: 'expresso', categoryId: 'cafes', station: 'cafe', emoji: '☕', name: 'Café expresso', price: 650,
    description: 'Blend da casa, torra média.', recipe: [{ insumoId: 'i-cafe', qty: 0.008 }] },
  { id: 'pingado', categoryId: 'cafes', station: 'cafe', emoji: '☕', name: 'Pingado', price: 600,
    description: 'Café coado com um pingo de leite.', options: [leite(0.03)],
    recipe: [{ insumoId: 'i-cafe', qty: 0.01 }] },
  { id: 'cappu', categoryId: 'cafes', station: 'cafe', emoji: '☕', name: 'Cappuccino', price: 1100,
    description: 'Expresso, leite vaporizado, chocolate e canela.',
    options: [tamanho([{ insumoId: 'i-cafe', qty: 0.006 }]), leite(0.15)],
    recipe: [{ insumoId: 'i-cafe', qty: 0.008 }, { insumoId: 'i-chocolate', qty: 0.005 }] },
  { id: 'media', categoryId: 'cafes', station: 'cafe', emoji: '🥛', name: 'Média', price: 700,
    description: 'Café com leite no copo americano.', options: [leite(0.12)],
    recipe: [{ insumoId: 'i-cafe', qty: 0.01 }] },

  // Bebidas
  { id: 'suco-lar', categoryId: 'bebidas', station: 'cafe', emoji: '🍊', name: 'Suco de laranja', price: 1100,
    description: 'Espremido na hora.', options: [tamanho([{ insumoId: 'i-laranja', qty: 0.4 }])],
    recipe: [{ insumoId: 'i-laranja', qty: 0.6 }] },
  { id: 'vitamina', categoryId: 'bebidas', station: 'cafe', emoji: '🍌', name: 'Vitamina de banana', price: 1200,
    description: 'Banana, leite e aveia.', options: [leite(0.25)],
    recipe: [{ insumoId: 'i-banana', qty: 0.15 }, { insumoId: 'i-acucar', qty: 0.01 }] },
  { id: 'agua', categoryId: 'bebidas', station: 'balcao', emoji: '💧', name: 'Água mineral', price: 450,
    description: 'Com ou sem gás, 500 ml.',
    options: [{ id: 'gas', name: 'Tipo', required: true, max: 1, choices: [
      { id: 'sem', name: 'Sem gás', price: 0,  recipe: [{ insumoId: 'i-agua', qty: 1 }] },
      { id: 'com', name: 'Com gás', price: 50, recipe: [{ insumoId: 'i-agua-gas', qty: 1 }] },
    ] }],
    recipe: [] },
  { id: 'refri', categoryId: 'bebidas', station: 'balcao', emoji: '🥤', name: 'Refrigerante lata', price: 650,
    description: 'Consulte os sabores no balcão.', recipe: [{ insumoId: 'i-refri', qty: 1 }] },
]

export function seedProducts(): Product[] {
  return seed.map((p) => ({ ...p, available: p.available ?? true, active: true }))
}
