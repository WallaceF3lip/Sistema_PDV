## Purpose

Permitir ao administrador analisar as vendas de um período (faturamento, formas de pagamento, canais Balcão/Retirada/Entrega, produtos mais vendidos, evolução diária, zonas de entrega e operadores) a partir de uma agregação feita no backend, exibida na página "Relatórios".

## ADDED Requirements

### Requirement: Endpoint de resumo de vendas restrito a ADMIN
O sistema SHALL expor `GET /reports/sales-summary` com os parâmetros obrigatórios `start_date` e `end_date` (formato `YYYY-MM-DD`, intervalo inclusivo) e opcionais `top_limit` (inteiro de 1 a 50, padrão 10) e `top_by` (`revenue` ou `quantity`, padrão `revenue`). O endpoint SHALL exigir usuário autenticado com papel ADMIN; operadores SHALL receber 403 e requisições sem autenticação SHALL receber 401. O endpoint SHALL ser somente leitura.

#### Scenario: Administrador consulta o resumo
- **WHEN** um ADMIN chama `GET /reports/sales-summary?start_date=2026-10-01&end_date=2026-10-31`
- **THEN** o sistema responde 200 com `start_date`, `end_date`, `generated_at` e as seções `totals`, `canceled`, `pending`, `by_payment_method`, `by_channel`, `top_products`, `by_day`, `by_zone` e `by_operator`

#### Scenario: Operador sem permissão
- **WHEN** um usuário OPERATOR chama `GET /reports/sales-summary`
- **THEN** o sistema responde 403 "Acesso restrito ao ADMIN"

#### Scenario: Parâmetro de ranking inválido
- **WHEN** um ADMIN envia `top_limit=0` ou `top_by=lucro`
- **THEN** o sistema responde 422

---

### Requirement: Validação do período
O sistema SHALL rejeitar com 422 e mensagem em português um período em que `start_date` seja posterior a `end_date` ou que tenha mais de 366 dias (contando os dois extremos).

#### Scenario: Data inicial depois da final
- **WHEN** um ADMIN consulta `start_date=2026-10-10&end_date=2026-10-01`
- **THEN** o sistema responde 422 "A data inicial deve ser anterior ou igual à data final"

#### Scenario: Período longo demais
- **WHEN** um ADMIN consulta `start_date=2025-01-01&end_date=2026-03-01`
- **THEN** o sistema responde 422 "O período máximo do relatório é de 366 dias"

#### Scenario: Período de um único dia
- **WHEN** um ADMIN consulta `start_date=2026-10-11&end_date=2026-10-11`
- **THEN** o sistema responde 200 com os dados apenas do dia de operação 11/10

---

### Requirement: Data de referência e regra de receita
Cada pedido SHALL ser atribuído a um dia pelo seu dia de operação (`business_date`). Para vendas pagas sem `business_date` (registros legados), o sistema SHALL usar a data, no fuso `America/Sao_Paulo`, do primeiro valor disponível entre `paid_at`, `closed_at` e `opened_at`. Somente vendas com status `PAID` SHALL contar como faturamento em `totals`, `by_payment_method`, `by_channel`, `top_products`, `by_day`, `by_zone` e `by_operator`. Vendas `OPEN` SHALL ser ignoradas em todas as seções. Um pedido `PENDING` quitado depois SHALL contar no dia de operação do pedido, não no dia do recebimento.

#### Scenario: Somente vendas pagas geram faturamento
- **WHEN** no período existem uma venda PAID de R$ 50,00, uma PENDING de R$ 30,00, uma CANCELED de R$ 20,00 e um carrinho OPEN de R$ 10,00
- **THEN** `totals.gross_total` é 50,00 e `totals.paid_count` é 1

#### Scenario: Virada do dia de operação respeitada
- **WHEN** `BUSINESS_DAY_CUTOFF_HOUR` é 4 e um pedido pago às 01:30 de 12/10 tem `business_date` 2026-10-11
- **THEN** o pedido aparece em `by_day` no dia 2026-10-11 e não entra em um relatório só do dia 12/10

#### Scenario: Venda legada sem dia de operação
- **WHEN** uma venda PAID sem `business_date` tem `closed_at` 2026-03-05T02:00:00Z (23:00 de 04/03 em Brasília)
- **THEN** ela é contabilizada no dia 2026-03-04

#### Scenario: Pendente quitado em outro dia
- **WHEN** um pedido com `business_date` 2026-10-10 é quitado em 11/10
- **THEN** o pedido conta como faturamento de 10/10

---

### Requirement: Totais do período
A seção `totals` SHALL conter, sobre as vendas pagas do período: `paid_count` (quantidade de pedidos), `gross_total` (soma de `total_amount`), `items_total` (soma dos subtotais dos itens), `delivery_fees_total` (soma de `delivery_fee`) e `avg_ticket` (`gross_total / paid_count`, 0 quando não houver vendas), com valores monetários arredondados a 2 casas. `gross_total` SHALL ser igual a `items_total + delivery_fees_total`. A seção `canceled` SHALL conter `count` e `total` (soma de `total_amount`) dos pedidos finalizados e depois cancelados no período (carrinhos cancelados sem finalização SHALL NOT contar). A seção `pending` SHALL conter `count` e `total` dos pedidos com status `PENDING` (a receber) no período, no momento da consulta.

#### Scenario: Totais com taxa de entrega
- **WHEN** no período há duas vendas pagas: Balcão de R$ 40,00 e Entrega com itens R$ 52,00 e taxa R$ 8,00
- **THEN** `totals` traz `paid_count` 2, `gross_total` 100,00, `items_total` 92,00, `delivery_fees_total` 8,00 e `avg_ticket` 50,00

#### Scenario: Período sem vendas
- **WHEN** não há nenhuma venda paga no período
- **THEN** `totals` traz todos os valores 0, `by_day` traz cada dia com zeros, `top_products`, `by_zone` e `by_operator` vêm vazios

#### Scenario: Cancelados e a receber separados
- **WHEN** no período há um pedido cancelado de R$ 25,00 e dois pedidos PENDING de R$ 30,00 e R$ 45,00
- **THEN** `canceled` é `{count: 1, total: 25,00}`, `pending` é `{count: 2, total: 75,00}` e nenhum deles entra em `totals`

---

### Requirement: Faturamento por forma de pagamento
A seção `by_payment_method` SHALL listar sempre as três formas, na ordem `CASH`, `CARD`, `PIX`, cada uma com `amount` (soma dos pagamentos registrados das vendas pagas do período) e `count` (quantidade de vendas pagas que usaram a forma). A soma de `amount` SHALL ser igual a `totals.gross_total`.

#### Scenario: Pagamento misto
- **WHEN** a única venda paga do período é de R$ 100,00 paga com R$ 60,00 em PIX e R$ 40,00 em dinheiro
- **THEN** `by_payment_method` traz CASH 40,00 (count 1), CARD 0,00 (count 0) e PIX 60,00 (count 1)

---

### Requirement: Faturamento por canal
A seção `by_channel` SHALL listar sempre os três canais, na ordem `COUNTER` (Balcão, pedido sem tipo), `PICKUP` (Retirada) e `DELIVERY` (Entrega), cada um com `count`, `gross_total`, `items_total`, `delivery_fees_total` e `avg_ticket` das vendas pagas do período.

#### Scenario: Quebra Balcão, Retirada e Entrega
- **WHEN** no período há 3 vendas pagas de Balcão somando R$ 90,00, 1 Retirada de R$ 35,00 e 2 Entregas somando R$ 110,00 com R$ 12,00 de taxas
- **THEN** `by_channel` traz COUNTER (3; 90,00), PICKUP (1; 35,00; taxas 0,00) e DELIVERY (2; 110,00; itens 98,00; taxas 12,00; ticket 55,00)

---

### Requirement: Produtos mais vendidos
A seção `top_products` SHALL listar até `top_limit` produtos vendidos em vendas pagas do período, com `product_id`, `product_name` (nome atual do produto), `quantity` (soma das quantidades), `revenue` (soma dos subtotais dos itens, sem taxa de entrega) e `sales_count` (quantidade de vendas distintas). A ordenação SHALL ser por `revenue` decrescente quando `top_by=revenue` e por `quantity` decrescente quando `top_by=quantity`, com desempate pelo outro critério e depois pelo nome.

#### Scenario: Ranking por receita
- **WHEN** um ADMIN consulta com `top_limit=2` e no período foram vendidos Pizza (5 un., R$ 250,00), Refrigerante (20 un., R$ 120,00) e Água (10 un., R$ 30,00)
- **THEN** `top_products` traz Pizza e Refrigerante, nessa ordem

#### Scenario: Ranking por quantidade
- **WHEN** a mesma consulta usa `top_by=quantity`
- **THEN** `top_products` traz Refrigerante e Água, nessa ordem

---

### Requirement: Série diária
A seção `by_day` SHALL conter uma entrada para **cada** dia do período, em ordem crescente, com `date`, `count`, `gross_total`, `items_total` e `delivery_fees_total` das vendas pagas daquele dia de operação; dias sem vendas SHALL aparecer com zeros. A soma das entradas SHALL ser igual a `totals`.

#### Scenario: Dia sem movimento
- **WHEN** um ADMIN consulta de 06/10 a 08/10 e só houve vendas pagas em 06/10 e 08/10
- **THEN** `by_day` tem 3 entradas e a de 2026-10-07 traz `count` 0 e valores 0,00

---

### Requirement: Entregas por zona e vendas por operador
A seção `by_zone` SHALL agrupar as vendas pagas de Entrega do período pela zona registrada na venda, com `zone_id` (nulo para entregas sem zona), `zone_name` ("Sem zona" quando nulo), `count`, `delivery_fees_total` e `gross_total`, ordenada por `gross_total` decrescente. A seção `by_operator` SHALL agrupar as vendas pagas do período pelo usuário que registrou a venda, com `user_id`, `user_name`, `count` e `gross_total`, ordenada por `gross_total` decrescente.

#### Scenario: Taxas por zona
- **WHEN** no período houve 2 entregas pagas para "Centro" (taxas R$ 5,00 cada) e 1 entrega sem zona com taxa manual de R$ 10,00
- **THEN** `by_zone` traz "Centro" (count 2, taxas 10,00) e "Sem zona" (count 1, taxas 10,00)

#### Scenario: Vendas por operador
- **WHEN** a operadora Ana registrou 4 vendas pagas somando R$ 200,00 e o administrador 1 venda de R$ 50,00
- **THEN** `by_operator` traz Ana (4; 200,00) antes do administrador (1; 50,00)

---

### Requirement: Página de Relatórios
O sistema SHALL oferecer a página "Relatórios" na rota `/reports`, acessível apenas a ADMIN (operadores são redirecionados ao Dashboard) e listada no menu lateral somente para ADMIN. A página SHALL permitir escolher o período por datas inicial/final e pelos atalhos Hoje, Ontem, Últimos 7 dias, Este mês, Mês passado e Fim de semana (sexta a domingo), calculados no fuso `America/Sao_Paulo`; o período inicial SHALL ser "Hoje". A página SHALL exibir cards de indicadores (faturamento, pedidos pagos, ticket médio, taxas de entrega, a receber, cancelados), gráfico de faturamento por dia, gráfico por forma de pagamento, gráfico por canal (Balcão, Retirada, Entrega), tabela de produtos mais vendidos, tabela de entregas por zona e tabela por operador, com valores em reais no formato brasileiro. Períodos inválidos SHALL ser bloqueados no próprio formulário.

#### Scenario: Acesso pelo menu
- **WHEN** um ADMIN abre o menu lateral e clica em "Relatórios"
- **THEN** a página carrega o relatório de hoje com indicadores, gráficos e tabelas

#### Scenario: Operador tenta acessar
- **WHEN** um OPERATOR acessa `/reports` diretamente
- **THEN** é redirecionado ao Dashboard e o item "Relatórios" não aparece no menu

#### Scenario: Atalho de fim de semana
- **WHEN** hoje é terça-feira 13/10/2026 e o ADMIN clica em "Fim de semana"
- **THEN** o período passa a ser 09/10/2026 a 11/10/2026 e o relatório é recarregado

#### Scenario: Atalho de fim de semana em andamento
- **WHEN** hoje é sábado 10/10/2026 e o ADMIN clica em "Fim de semana"
- **THEN** o período passa a ser 09/10/2026 a 10/10/2026

#### Scenario: Período sem vendas
- **WHEN** o período escolhido não tem vendas pagas
- **THEN** os cards mostram zeros, os gráficos mostram estado vazio ("Sem vendas no período") e as tabelas mostram mensagem de vazio

#### Scenario: Data inicial depois da final
- **WHEN** o ADMIN escolhe data inicial posterior à final
- **THEN** a página mostra a mensagem de período inválido e não faz a requisição

---

### Requirement: Exportação CSV
A página de Relatórios SHALL permitir exportar, no navegador e sem nova requisição ao servidor, a série diária e os produtos mais vendidos do relatório exibido em arquivos CSV compatíveis com Excel em português (UTF-8 com BOM, separador `;`, decimais com vírgula), com nome contendo o período (ex.: `vendas-por-dia_2026-10-01_2026-10-31.csv`).

#### Scenario: Exportar vendas por dia
- **WHEN** o ADMIN clica em "Exportar CSV" na seção de faturamento por dia
- **THEN** o navegador baixa um CSV com cabeçalho `Data;Pedidos;Faturamento;Itens;Taxas de entrega` e uma linha por dia do período

#### Scenario: Exportar produtos
- **WHEN** o ADMIN clica em "Exportar CSV" na tabela de produtos mais vendidos
- **THEN** o navegador baixa um CSV com `Produto;Quantidade;Receita;Vendas` para os produtos exibidos
