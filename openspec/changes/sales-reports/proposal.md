## Why

Hoje a única visão gerencial do sistema é o Dashboard (`pages/dashboard`), que baixa **todas** as vendas do dia via `GET /sales` e agrega no navegador (faturamento, ticket médio, vendas por hora e por forma de pagamento) — só para "hoje", filtrando pela data de abertura do carrinho e sem separar Balcão/Retirada/Entrega, taxas de entrega ou produtos. O dono do estabelecimento precisa analisar períodos (ontem, semana, mês, fim de semana) para decidir compras, escala e preços. Com a taxa de entrega no total (`delivery-zones-and-fee`), o caixa único com canais (`single-cash-register`) e o dia de operação (`business_date`/`paid_at` de `daily-orders-board`) já definidos, é possível oferecer relatórios básicos confiáveis, agregados no banco.

## What Changes

- **Pré-requisitos**: `customer-registry`, `delivery-zones-and-fee`, `single-cash-register` e `daily-orders-board` implementadas (`Sale.delivery_fee`, `Sale.delivery_zone_id`, `items_total`; `payments.method`; `Sale.business_date`, `Sale.paid_at`; `OrderTypeFilterEnum` COUNTER/PICKUP/DELIVERY; script `daily_orders_board.sql` executado).
- Novo endpoint `GET /reports/sales-summary?start_date&end_date[&top_limit&top_by]` (somente ADMIN) com agregação SQL, retornando para o período (por dia de operação):
  - totais de vendas **pagas** (faturamento bruto, itens, taxas de entrega, quantidade de pedidos, ticket médio);
  - separadamente, pedidos cancelados (quantidade/valor) e pendentes "a receber" (quantidade/valor);
  - faturamento por forma de pagamento (Dinheiro/Cartão/PIX);
  - por canal: Balcão (`COUNTER`), Retirada (`PICKUP`) e Entrega (`DELIVERY`);
  - produtos mais vendidos (quantidade e receita, limite configurável);
  - série por dia (todos os dias do período, com zeros);
  - entregas por zona (pedidos, taxas e faturamento) e vendas por operador.
- Validação de período: `start_date <= end_date` e no máximo 366 dias (422 com mensagem em português).
- Nova página `/reports` "Relatórios" (somente ADMIN, `adminGuard`) com seletor de período e atalhos (Hoje, Ontem, Últimos 7 dias, Este mês, Mês passado, Fim de semana sex–dom), cards de indicadores, gráficos chart.js (faturamento por dia, formas de pagamento, canais), tabela de produtos mais vendidos (`app-data-table`), tabelas por zona e por operador, e exportação CSV no navegador.
- Item "Relatórios" no sidebar (`adminOnly`) e card "Relatórios" (`adminOnly`) no Dashboard; ao tocar o Dashboard, remover o método de depuração `teste()` e os `console.log` remanescentes.
- O Dashboard **continua** com a agregação no cliente (o novo endpoint é restrito a ADMIN e o Dashboard é visto por operadores) — migração fica fora do escopo.

## Capabilities

### New Capabilities
- `sales-reports`: Relatório de vendas por período — endpoint administrativo de agregação (`GET /reports/sales-summary`) com regras de receita (somente `PAID`, por dia de operação), cancelados/pendentes, quebras por forma de pagamento, canal, produto, dia, zona e operador; e página "Relatórios" com atalhos de período, indicadores, gráficos e exportação CSV.

### Modified Capabilities
<!-- Nenhuma: as specs arquivadas (data-table-pagination, sales-history-view) não mudam; capacidades de venda/caixa dos pré-requisitos ainda não foram arquivadas. -->

## Impact

- **Backend**: novos `app/routers/reports.py` e `app/services/report_service.py`; `app/schemas/schemas.py` (schemas `SalesSummaryOut` e afins, enum `TopProductsOrderEnum`); `main.py` (`include_router`). Sem novas tabelas nem colunas — **sem script SQL** (usa os índices `ix_sales_business_date` e `ix_sales_delivery_zone_id` criados pelos pré-requisitos).
- **API**: novo endpoint somente leitura; nenhum contrato existente muda.
- **Frontend**: novos `core/models/report.model.ts` (no barrel) e `core/services/report.service.ts`; nova página `pages/reports`; `app.routes.ts` (rota com `adminGuard`); `shared/components/sidebar` (item `adminOnly`); `pages/dashboard` (card `adminOnly` e limpeza de `teste()`/`console.log`). Reutiliza `chart.js` (já em `package.json`) e `app-data-table`.
- **Dependências**: nenhuma nova.
