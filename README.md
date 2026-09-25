# PDV de autoatendimento — multi-loja

Plataforma para padarias, cafés e restaurantes **sem garçom tirando pedido**. O cliente recebe
uma comanda física, registra no celular (QR, código de barras ou número), pede pelo cardápio
como num e-commerce e o pedido vai **direto para a cozinha**. O salão só leva até a mesa, e o
caixa recebe na saída. O produto é white-label: cada estabelecimento aparece com o próprio nome.
A loja de demonstração é o **Cortiço**.

> Fase atual: **validação de fluxo com dados reais no Firestore**. O conteúdo da loja Cortiço é de
> demonstração; os 30 dias de histórico dos relatórios ainda são gerados no navegador.

No ar: https://pdv-padaria.netlify.app (cada push na `main` publica sozinho).

## Módulos

| Módulo | Rota | Quem usa | Tema |
|---|---|---|---|
| Plataforma | `/` | — | claro dourado |
| Cliente | `/cortico`, `/cardapio`, `/sacola`, `/pedidos` | cliente, no próprio celular | claro dourado |
| Login da equipe | `/cortico/equipe` | equipe (PIN) | escuro dourado |
| Cozinha | `/cortico/cozinha` | cozinha, gerência | escuro dourado |
| Salão | `/cortico/salao` | salão, caixa, gerência | escuro dourado |
| Administrativo | `/cortico/admin/...` | caixa, gerência | escuro dourado |

O tema da equipe pode ser trocado para claro em **Configurações**.

**Cliente.** Registra a comanda pela câmera (BarcodeDetector nativo, com zxing-wasm como
fallback para Safari/iOS), pelo QR impresso (`/cortico?c=0042` abre já registrado) ou digitando
o número. O nome é opcional. No cardápio escolhe adicionais e observações. Na sacola informa
onde está (mesa, balcão ou para viagem). Depois acompanha cada pedido: Recebido → Preparando →
Pronto → Entregue. Quando o caixa fecha a conta, o app volta sozinho para a entrada com um
agradecimento.

**Cozinha.** Fila em três colunas (Novos, Em preparo, Prontos), com filtro por estação
(cozinha, café, balcão). Cada ticket tem a cor do tempo de espera, o destino, o nome do
cliente, as observações e o aviso de embalar para viagem. Dá baixa em "Saiu da cozinha" e
esgota itens pela **Disponibilidade**.

**Salão.** Painel no estilo fast-food. Os prontos ficam em dourado no topo; os que ainda estão
na cozinha mudam de cor pelo tempo (verde, laranja, vermelho). Dá baixa em "Entregue na mesa",
com opção de desfazer. A visão **Mesas** mostra o mapa do salão com o que está pronto ou
atrasado em cada mesa.

**Administrativo.**
- **Visão geral:** faturamento, comandas em aberto, tempo de cozinha, margem, pedidos por hora e estoque em alerta.
- **Comandas:** abertas e fechadas, detalhe com pedidos, cancelamento de item com motivo, lançamento de itens e venda direta no balcão. O fechamento de conta aceita PIX, dinheiro com troco, débito, crédito, vale-refeição e pagamento misto, com desconto e taxa de serviço, e emite a NFC-e.
- **Caixa:** abertura com fundo, sangria e suprimento, resumo por forma de pagamento e fechamento com conferência da gaveta.
- **Fiscal (NFC-e):** emissão pela Focus NFe, com o modo simulado enquanto a loja não está credenciada. CPF na nota, reenvio, consulta, cancelamento com prazo e justificativa, e checklist do que falta para emitir de verdade. Passo a passo em [docs/FISCAL.md](docs/FISCAL.md).
- **Cardápio:** preço, custo e margem por item. O editor de **ficha técnica** calcula CMV, margem e preço sugerido.
- **Estoque:** por insumo, com compra, produção da casa, perda e ajuste por contagem. Mostra o consumo teórico do dia. Um produto esgota sozinho quando falta insumo.
- **Relatórios:** hoje, 7 ou 30 dias. Faturamento, ticket médio, CMV, margem bruta, tempo de cozinha, formas de pagamento, categorias e produtos, com exportação em CSV.
- **Configurações:** tempos de alerta, mesas, taxa de serviço, faixa de comandas e bloqueadas, equipe e PINs, e reset dos dados de exemplo.

## Rodando

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev:celular    # https na rede local, para abrir a câmera no celular
```

Com um `.env.local` com as chaves `VITE_FIREBASE_*`, o app usa o Firestore. Sem ele (ou com
`VITE_DATA_BACKEND=local`), roda no modo mock, com tudo no localStorage do navegador.

## Firebase

Projeto `pdv-autoatendimento`, Firestore em `southamerica-east1` (São Paulo).

```bash
npm run deploy:firebase   # publica firestore.rules e liga o login anônimo
npm run seed:firestore    # carga inicial da loja de demonstração (só enquanto ela não existe)
npm run check:rules       # confere as regras contra o banco real, como visitante anônimo
npm run reset:demo -- --pin 0000   # recria o "dia de hoje" da demonstração (PIN da gerência)
npm test                  # testes do módulo fiscal
```

- **Dados:** cada loja fica em `tenants/{slug}`. O doc da loja guarda as configurações; as
  subcoleções guardam o resto (`products`, `insumos`, `stockMoves`, `comandas`, `orders`,
  `cashierSessions`, `cashMovements`, `nfce`, `staff`, `staffPins`, `sessions`, `counters`,
  `openComandas`).
- **Cliente:** entra com login anônimo, lê só o cardápio e acompanha a própria comanda e os
  próprios pedidos pelo id. Só cria pedido em comanda aberta.
- **Equipe:** acertar o PIN cria `sessions/{uid}`. Quem confere o PIN são as regras, contra
  `staffPins`, que nenhum cliente consegue ler. Cada coleção exige o perfil certo: a cozinha
  não mexe no caixa, e só a gerência altera configurações e equipe.
- **Concorrência:** a senha do dia, a NFC-e e a venda direta usam contadores em transação. O
  estoque baixa com incremento atômico, e cada gravação envia só os campos alterados.
- **Estoque:** os insumos baixam quando a cozinha inicia o preparo (ou na venda direta do
  caixa). O cliente não lê o estoque; o "esgotado por falta de insumo" chega a ele pelo campo
  `stockOut` do produto, mantido pela equipe.

## Testando o fluxo

Abra um aparelho, ou uma aba, para cada papel: cliente em `/cortico`, cozinha em
`/cortico/cozinha`, salão em `/cortico/salao` e caixa em `/cortico/admin`. Os dados sincronizam
em tempo real entre todos eles, e o login da equipe vale só para a aba em que foi feito.

PINs de demonstração: Cozinha **1111** · Salão **2222** · Caixa **3333** · Gerência **0000**.
Comanda de teste: **042**. A comanda **013** está bloqueada.

## Arquitetura

Usa a mesma stack do PDV Casa Ó: Vue 3 (Composition API), Pinia, Vue Router 4, SCSS puro, Vite
e TypeScript.

```
src/
  mock/            dados da loja (cortico/), seed do dia e histórico de 30 dias
  db/              coleções (Firestore ou mock), contadores, seed da demonstração
  firebase/        inicialização e login anônimo
  stores/          catálogo+estoque, comandas, pedidos, caixa, equipe, cliente, sacola
  lib/             ficha técnica, relatórios, tempos, NFC-e, formatação, permissões por módulo
  pages/           customer/, staff/ (login, cozinha, salão), admin/
  components/      ui/ (base da Casa Ó + drawer, sheet, stat), charts/, customer/, staff/, admin/
```

- **Multi-loja:** a loja vem do primeiro segmento da URL e todos os dados ficam separados por
  ela. Para cadastrar outra loja, adicione um pacote em `src/mock/` e registre em
  `src/mock/tenants.ts`.
- **Ficha técnica:** as receitas guardam quantidades na unidade do insumo (kg, l ou un) e os
  adicionais têm receita própria. Cada venda congela preço e custo no item, para o CMV
  histórico não mudar quando o custo médio mudar.
- **Histórico:** os 30 dias anteriores são gerados de forma determinística na memória (sempre
  iguais) e não ocupam o localStorage.
- **Camada de dados:** `src/db/collection.ts` dá a mesma interface às stores nos dois modos
  (Firestore ou mock). Cada coleção assina o que o aparelho pode ver: a equipe vê a operação
  inteira, o cliente só a própria comanda.

## Fora do escopo do mock (próximos passos)

- Login da equipe com conta própria (hoje: PIN de 4 dígitos por loja, validado nas regras) e App Check
- Cadastro de lojas pelo próprio app
- Relatórios com o histórico real do Firestore (hoje: dias anteriores gerados no navegador)
- Preço do pedido do cliente conferido no servidor (hoje: o app calcula e o caixa confere)
- Contingência offline da NFC-e sem internet na loja (ver docs/FISCAL.md)
- Edição de adicionais no editor de produto (hoje vêm do cadastro inicial)
- Push notification de "pedido pronto" com a tela bloqueada
- Impressão das comandas físicas com QR/código de barras e ticket de cozinha
- OCR do número impresso (hoje: QR, código de barras ou digitação)
