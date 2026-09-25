# NFC-e (modelo 65)

O app emite NFC-e por um **provedor fiscal**, hoje a [Focus NFe](https://doc.focusnfe.com.br).
Enquanto a loja não está credenciada, tudo roda no **modo simulado**: a mesma tela e o mesmo fluxo,
sem valor fiscal. Ligar a emissão de verdade é configuração; não exige mudar código.

## Como funciona

```
Caixa fecha a conta
  ├─ 1. pagamento gravado na comanda          (a venda nunca se perde)
  ├─ 2. nota criada como "pendente"            (tenants/{loja}/nfce/{id da comanda})
  └─ 3. POST /api/nfce  ──►  função no Netlify  ──►  Focus NFe  ──►  SEFAZ
                              │  confere o login do Firebase e se é caixa/gerência
                              │  confere de novo itens, totais e pagamentos
                              └─ usa o token da loja (variável de ambiente, nunca no navegador)
        ◄── autorizada · rejeitada (com o motivo) · contingência · pendente (sem resposta)
```

- **Referência única** = id da comanda. Reenviar ou consultar usa a mesma referência, então uma
  queda no meio nunca gera nota em dobro.
- **Certificado A1 e CSC ficam na conta do provedor.** O app e o Firestore nunca veem nenhum dos
  dois.
- **A tributação vem do cadastro do produto** (NCM, CFOP, CSOSN/CST, origem, unidade). Produto
  com cadastro incompleto bloqueia a nota e o motivo aparece na tela.

| Parte | Arquivo |
|---|---|
| Montagem da nota e conferência dos totais | `src/fiscal/request.ts` |
| Adaptador Focus NFe (envio e retorno) | `src/fiscal/focus.ts` |
| Tabelas (tPag, CSOSN, CFOP) e validações (CPF, CNPJ, NCM) | `src/fiscal/codes.ts`, `src/fiscal/validate.ts` |
| Servidor | `netlify/functions/nfce.mts` → `/api/nfce` |
| Emitir, reenviar, consultar, cancelar | `src/stores/useFiscalStore.ts` |
| Tela | Administrativo → **Fiscal** (Notas, Emitente, Produtos) |
| Testes | `tests/fiscal.test.ts` (`npm test`) |

## Regras aplicadas

- **Cancelamento:** justificativa de 15 a 255 caracteres, dentro de **30 minutos** da autorização
  (prazo de SP, configurável). Fora do prazo, o app avisa e não tenta; a correção é com o contador.
  Cancelar a nota não desfaz o pagamento.
- **Contingência:** a nota em contingência mostra o prazo de transmissão (24 h, configurável).
- **Desconto:** rateado entre os itens pelo valor de cada um; a soma fecha no centavo.
- **Taxa de serviço:** por padrão fica fora da nota. Nesse caso os pagamentos são reduzidos ao total
  da nota. Se ligada, entra como "outras despesas".
- **Troco:** não é informado. A nota leva o valor exato da venda; o troco é opcional no leiaute.
- **Itens cancelados** não entram na nota.
- **Pagamento misto:** vira uma forma de pagamento por parcela.
- **Códigos tPag:** PIX 17, dinheiro 01, crédito 03, débito 04, vale-refeição 11. Cartão vai como
  maquininha não integrada (tpIntegra 2).
- **CPF na nota** é opcional e validado pelo dígito verificador. Só caixa e gerência leem as notas.

## Colocando uma loja no ar

1. **Contador:** confirma o regime (CRT) e a inscrição estadual e revisa a tributação de cada
   produto no app, em Fiscal → Produtos (NCM, CFOP, CSOSN ou CST, e CEST onde houver
   substituição tributária). Cada produto conferido recebe a marca **Conferido pelo contador**. Os
   valores da loja de demonstração são estimativas e estão todos como "a revisar".
2. **Certificado digital:** e-CNPJ **A1** (arquivo .pfx) de uma AC ICP-Brasil.
3. **Credenciamento** como emissor de NFC-e na SEFAZ do estado (SP: portal da Secretaria da Fazenda).
4. **CSC e ID Token** gerados no portal da SEFAZ, um par para homologação e outro para produção.
5. **Focus NFe:** crie a conta e cadastre a empresa pelo painel ou pela API (`POST /v2/empresas`,
   com `arquivo_certificado_base64`, `senha_certificado`, `habilita_nfce`,
   `csc_nfce_homologacao`, `id_token_nfce_homologacao`, `csc_nfce_producao`,
   `id_token_nfce_producao`, `serie_nfce_*`, `proximo_numero_nfce_*`). A resposta traz
   `token_homologacao` e `token_producao`.
6. **Tokens no Netlify.** Nunca no código nem no Firestore:
   ```bash
   netlify env:set NFCE_FOCUS_TOKEN_CORTICO_HOMOLOGACAO "<token de homologação>"
   netlify env:set NFCE_FOCUS_TOKEN_CORTICO_PRODUCAO "<token de produção>"
   ```
   O nome segue o padrão `NFCE_FOCUS_TOKEN_<LOJA>_<AMBIENTE>`, com o slug da loja em maiúsculas e
   hífen virando `_`. Depois de criar a variável, publique de novo (um push na `main` basta).
7. **No app**, como gerência: Fiscal → Emitente → dados completos → modo **Focus NFe ·
   Homologação** → Salvar → **Verificar servidor**. O checklist no topo da página precisa ficar
   todo verde.
8. **Bateria de homologação.** Cada caso precisa terminar autorizado na SEFAZ ou com o
   comportamento esperado:
   - venda em PIX, em dinheiro, no crédito, no débito e no vale-refeição
   - pagamento misto
   - com desconto, com CPF e com a taxa de serviço dentro e fora da nota
   - comanda com item cancelado
   - cancelamento dentro do prazo, e a tentativa fora do prazo (precisa ser recusada no app)
   - rejeição proposital (NCM inválido num produto), corrigir e **Reenviar** com a mesma nota
   - internet cortada durante a emissão: a nota fica pendente, e depois **Consultar** ou
     **Reenviar** resolve sem duplicar
9. **Produção:** modo **Focus NFe · Produção** (o app pede confirmação). Acompanhe a primeira venda
   real até a nota aparecer como autorizada na consulta da SEFAZ.

## Limites conhecidos

- **Sem internet na loja, não há emissão.** A venda fica registrada e a nota fica pendente, para
  reenviar quando a conexão voltar. A contingência offline da Focus (o comunicador local) ainda
  não está integrada.
- **Inutilização de numeração** não tem tela. A Focus numera sozinha, então só é necessária em
  casos raros, pelo painel dela.
- **Reforma tributária (IBS/CBS):** os campos `ibsCbsCst` e `ibsCbsClassTrib` do produto já são
  repassados ao provedor quando preenchidos. O contador diz quando passam a ser obrigatórios para a
  loja.
- **Preço do pedido do cliente:** é calculado no app e conferido pelo caixa. O servidor confere que
  os totais fecham, mas não recalcula o preço a partir do cardápio.

## Trocar de provedor

Escreva um adaptador no mesmo formato de `src/fiscal/focus.ts`: converter o `NfceRequest` para o
formato do provedor e normalizar a resposta em `FiscalResult`. Depois escolha o adaptador em
`netlify/functions/nfce.mts`. A montagem da nota, as telas e o banco não mudam.
