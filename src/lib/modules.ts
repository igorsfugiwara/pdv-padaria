import type { Role } from '@/types'

// Módulos da equipe e quem acessa cada um. O router usa `roles` para proteger
// as rotas; o menu lateral e o seletor de módulos mostram só o que o perfil pode abrir.
export interface ModuleDef {
  route: string
  label: string
  icon: string
  group: 'operacao' | 'gestao'
  roles: Role[]
}

export const modules: ModuleDef[] = [
  { route: 'kitchen',             label: 'Cozinha',       icon: '◉', group: 'operacao', roles: ['cozinha', 'gerente'] },
  { route: 'salon',               label: 'Salão',         icon: '◎', group: 'operacao', roles: ['salao', 'caixa', 'gerente'] },
  { route: 'admin-dashboard',     label: 'Visão geral',   icon: '⊞', group: 'gestao',   roles: ['caixa', 'gerente'] },
  { route: 'admin-comandas',      label: 'Comandas',      icon: '≡', group: 'gestao',   roles: ['caixa', 'gerente'] },
  { route: 'admin-caixa',         label: 'Caixa',         icon: '⊟', group: 'gestao',   roles: ['caixa', 'gerente'] },
  { route: 'admin-fiscal',        label: 'Fiscal',        icon: '§', group: 'gestao',   roles: ['caixa', 'gerente'] },
  { route: 'admin-cardapio',      label: 'Cardápio',      icon: '◫', group: 'gestao',   roles: ['caixa', 'gerente'] },
  { route: 'admin-estoque',       label: 'Estoque',       icon: '▦', group: 'gestao',   roles: ['cozinha', 'caixa', 'gerente'] },
  { route: 'admin-relatorios',    label: 'Relatórios',    icon: '↗', group: 'gestao',   roles: ['gerente'] },
  { route: 'admin-configuracoes', label: 'Configurações', icon: '⚙', group: 'gestao',   roles: ['gerente'] },
]

export function rolesFor(route: string): Role[] {
  return modules.find((m) => m.route === route)?.roles ?? ['gerente']
}

export function modulesFor(role: Role | null): ModuleDef[] {
  return role ? modules.filter((m) => m.roles.includes(role)) : []
}
