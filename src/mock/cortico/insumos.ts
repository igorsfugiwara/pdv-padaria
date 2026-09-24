import type { Insumo } from '@/types'

// Insumos do Cortiço. Custos em centavos por unidade (kg, litro ou unidade).
// `produced` = feito na casa (pães, salgados, bolos): entra por produção, não por compra.

type Base = Omit<Insumo, 'stock'> & { stock?: number }

const base: Base[] = [
  // Padaria (produção própria)
  { id: 'i-frances',     name: 'Pão francês',            unit: 'un', minStock: 60,  avgCost: 38,   produced: true },
  { id: 'i-forma',       name: 'Pão de forma (fatia)',   unit: 'un', minStock: 40,  avgCost: 28,   produced: true },
  { id: 'i-italiano',    name: 'Pão italiano 500 g',     unit: 'un', minStock: 4,   avgCost: 640,  produced: true, stock: 0 },
  { id: 'i-hamburguer',  name: 'Pão de hambúrguer',      unit: 'un', minStock: 12,  avgCost: 95,   produced: true },
  { id: 'i-croissant',   name: 'Croissant (massa)',      unit: 'un', minStock: 10,  avgCost: 210,  produced: true },
  { id: 'i-massa-pq',    name: 'Massa de pão de queijo', unit: 'kg', minStock: 2,   avgCost: 2600, produced: true },
  { id: 'i-coxinha',     name: 'Coxinha',                unit: 'un', minStock: 15,  avgCost: 210,  produced: true },
  { id: 'i-esfiha',      name: 'Esfiha de carne',        unit: 'un', minStock: 15,  avgCost: 180,  produced: true },
  { id: 'i-empada',      name: 'Empada de palmito',      unit: 'un', minStock: 10,  avgCost: 240,  produced: true },
  { id: 'i-quiche',      name: 'Quiche (fatia)',         unit: 'un', minStock: 6,   avgCost: 460,  produced: true },
  { id: 'i-sonho',       name: 'Sonho',                  unit: 'un', minStock: 10,  avgCost: 190,  produced: true },
  { id: 'i-bolo-fuba',   name: 'Bolo de fubá (fatia)',   unit: 'un', minStock: 8,   avgCost: 140,  produced: true },
  { id: 'i-bolo-cen',    name: 'Bolo de cenoura (fatia)',unit: 'un', minStock: 8,   avgCost: 170,  produced: true, stock: 5 },
  { id: 'i-pudim',       name: 'Pudim (fatia)',          unit: 'un', minStock: 6,   avgCost: 310,  produced: true },

  // Frios, laticínios e proteínas
  { id: 'i-manteiga',    name: 'Manteiga',               unit: 'kg', minStock: 2,   avgCost: 4900, supplier: 'Laticínios Serra' },
  { id: 'i-q-prato',     name: 'Queijo prato',           unit: 'kg', minStock: 2,   avgCost: 4400, supplier: 'Laticínios Serra' },
  { id: 'i-mussarela',   name: 'Queijo muçarela',        unit: 'kg', minStock: 2,   avgCost: 3900, supplier: 'Laticínios Serra' },
  { id: 'i-requeijao',   name: 'Requeijão',              unit: 'kg', minStock: 1,   avgCost: 2700, supplier: 'Laticínios Serra' },
  { id: 'i-presunto',    name: 'Presunto',               unit: 'kg', minStock: 2,   avgCost: 3300, supplier: 'Frios Bom Corte' },
  { id: 'i-bacon',       name: 'Bacon',                  unit: 'kg', minStock: 1,   avgCost: 4300, supplier: 'Frios Bom Corte', stock: 0.6 },
  { id: 'i-rosbife',     name: 'Rosbife',                unit: 'kg', minStock: 1,   avgCost: 8900, supplier: 'Frios Bom Corte' },
  { id: 'i-hamb-120',    name: 'Hambúrguer 120 g',       unit: 'un', minStock: 10,  avgCost: 460,  supplier: 'Frios Bom Corte' },
  { id: 'i-ovo',         name: 'Ovo',                    unit: 'un', minStock: 60,  avgCost: 72,   supplier: 'Granja Vista Alegre' },
  { id: 'i-frango',      name: 'Filé de frango',         unit: 'kg', minStock: 4,   avgCost: 2500, supplier: 'Frios Bom Corte' },
  { id: 'i-contra',      name: 'Contrafilé',             unit: 'kg', minStock: 3,   avgCost: 5400, supplier: 'Frios Bom Corte' },
  { id: 'i-leite',       name: 'Leite integral',         unit: 'l',  minStock: 12,  avgCost: 540,  supplier: 'Laticínios Serra' },
  { id: 'i-leite-desn',  name: 'Leite desnatado',        unit: 'l',  minStock: 6,   avgCost: 580,  supplier: 'Laticínios Serra' },
  { id: 'i-aveia',       name: 'Bebida de aveia',        unit: 'l',  minStock: 3,   avgCost: 1850, supplier: 'Empório Natural' },

  // Hortifruti e secos
  { id: 'i-tomate',      name: 'Tomate',                 unit: 'kg', minStock: 3,   avgCost: 790,  supplier: 'Hortifruti Ceasa' },
  { id: 'i-folhas',      name: 'Mix de folhas',          unit: 'kg', minStock: 1,   avgCost: 2200, supplier: 'Hortifruti Ceasa' },
  { id: 'i-batata',      name: 'Batata',                 unit: 'kg', minStock: 5,   avgCost: 520,  supplier: 'Hortifruti Ceasa' },
  { id: 'i-laranja',     name: 'Laranja',                unit: 'kg', minStock: 10,  avgCost: 360,  supplier: 'Hortifruti Ceasa' },
  { id: 'i-banana',      name: 'Banana',                 unit: 'kg', minStock: 3,   avgCost: 520,  supplier: 'Hortifruti Ceasa' },
  { id: 'i-arroz',       name: 'Arroz',                  unit: 'kg', minStock: 5,   avgCost: 620,  supplier: 'Atacado Central' },
  { id: 'i-feijao',      name: 'Feijão',                 unit: 'kg', minStock: 4,   avgCost: 890,  supplier: 'Atacado Central' },
  { id: 'i-cafe',        name: 'Café em grãos',          unit: 'kg', minStock: 2,   avgCost: 7800, supplier: 'Torrefação Mantiqueira' },
  { id: 'i-chocolate',   name: 'Chocolate meio amargo',  unit: 'kg', minStock: 1,   avgCost: 4300, supplier: 'Atacado Central' },
  { id: 'i-acucar',      name: 'Açúcar',                 unit: 'kg', minStock: 3,   avgCost: 460,  supplier: 'Atacado Central' },

  // Revenda
  { id: 'i-agua',        name: 'Água mineral 500 ml',    unit: 'un', minStock: 24,  avgCost: 120,  supplier: 'Distribuidora Sul' },
  { id: 'i-agua-gas',    name: 'Água com gás 500 ml',    unit: 'un', minStock: 12,  avgCost: 145,  supplier: 'Distribuidora Sul' },
  { id: 'i-refri',       name: 'Refrigerante lata',      unit: 'un', minStock: 24,  avgCost: 290,  supplier: 'Distribuidora Sul' },
  { id: 'i-embalagem',   name: 'Embalagem para viagem',  unit: 'un', minStock: 50,  avgCost: 65,   supplier: 'Embalagens Ideal' },
]

// Saldo inicial: ~3× o mínimo, com exceções declaradas acima (itens em alerta no mock)
export function seedInsumos(): Insumo[] {
  return base.map((b) => ({
    ...b,
    stock: b.stock ?? Math.round(b.minStock * 3.2 * 100) / 100,
  }))
}
