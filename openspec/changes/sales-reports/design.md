## Context

Motivação em proposal.md. Requisitos em `specs/sales-reports/spec.md`. **Pré-requisitos implementados**: `customer-registry`, `delivery-zones-and-fee` (`Sale.delivery_fee`, `Sale.delivery_zone_id` + relação `delivery_zone`, `total_amount` = itens + taxa, índice `ix_sales_delivery_zone_id`), `single-cash-register` (`sale_channel(order_type)`, `Sale.cash_register_id`) e `daily-orders-board` (`Sale.paid_at`, `Sale.business_date` com índice `ix_sales_business_date`, `Sale.daily_number`, `app/core/business_day.py`, `Settings.BUSINESS_TIMEZONE`, enum Python-only `OrderTypeFilterEnum` COUNTER/PICKUP/DELIVERY em `app/schemas/schemas.py`, backfill de `business_date`/`paid_at` em `daily_orders_board.sql`).

Estado atual verificado no código:

- `pdv_API/main.py`: registra routers `auth, users, products, stock, sales, cash_registers`; `create_all` no startup.
- `pdv_API/app/core/security.py`: `require_admin` (403 "Acesso restrito ao ADMIN").
- `pdv_API/app/models/sale.py`: `Sale.user_id` (quem abriu/registrou a venda), `SaleItem` (`product_id`, `quantity` Numeric(10,3), `subtotal`), `Payment` (`method`, `amount`). `app/models/user.py`: `User.name`. Valores monetários são `Numeric` → `Decimal`.
- `pdv_View/src/app/pages/dashboard/dashboard.component.ts`: chama `saleService.list(hoje, hoje)` (filtro `func.date(Sale.opened_at)` em `routers/sales.py`), agrega no cliente (KPIs, barras por hora, rosca por forma de pagamento) com `chart.js` (`Chart.register(...registerables)`), cores/fontes inline; contém o método de depuração `teste()` (não usado no template) e `console.log("sales: ", sales)`. O Dashboard é visível a todos os papéis; seus `cards` têm suporte a `adminOnly`.
- `shared/components/sidebar/sidebar.component.ts`: `navItems` com `adminOnly`; `core/guards/admin.guard.ts` redireciona não-ADMIN a `/dashboard`.
- `shared/components/data-table`: `columns: TableColumn[]`, `data` (signal ou array), `loading`, `paginate`, `pageSize`, templates `dtCell`.
- `pages/sales-history` calcula "hoje" com `toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })`.
- Sem testes automatizados no backend (`pdv_API/tests` não existe).

## Goals / Non-Goals

**Goals:**
- Uma única requisição por período, agregada no PostgreSQL (sem trafegar vendas individuais).
- Regras de receita explícitas e coerentes com o caixa e o quadro do dia (mesmo dia de operação, mesmas classificações de canal).
- Página administrativa leve, reutilizando `chart.js`, tokens de `styles.scss` e `app-data-table`.

**Non-Goals:**
- Migrar o Dashboard para o novo endpoint (é visto por operadores; o endpoint é ADMIN). Fica para uma change futura com um endpoint "resumo de hoje" não administrativo.
- Lucro/margem (custo do produto não é snapshot na venda), comparação entre períodos, gráfico por hora, relatório por cliente.
- Exportação PDF/Excel nativo, impressão do relatório, agendamento/envio por e-mail.
- Cache, visões materializadas ou novos índices/colunas (volume de um PDV é baixo).
- Reconciliação com o caixa (já coberta por `GET /cash-registers/{id}/summary`).

## Decisions

### 1. Data de agrupamento: `business_date` com fallback para legado
**Decisão**: expressão SQL `report_date = COALESCE(sales.business_date, CAST(timezone(:tz, COALESCE(sales.paid_at, sales.closed_at, sales.opened_at)) AS DATE))`, com `:tz = settings.BUSINESS_TIMEZONE`. Filtro de período escrito para usar o índice: `(business_date BETWEEN :s AND :e) OR (business_date IS NULL AND <fallback> BETWEEN :s AND :e)`. O fallback só é aplicado a vendas `PAID`; `CANCELED`/`PENDING` exigem `business_date IS NOT NULL`.
**Rationale**: `business_date` é o dia de operação usado pelo quadro, pela numeração e pela comanda — o dono reconhece "o sábado" incluindo a madrugada (`BUSINESS_DAY_CUTOFF_HOUR`). Pedidos `PENDING` quitados depois contam no dia do pedido (competência), que é como o fim de semana é analisado. O fallback cobre vendas pagas que, por algum motivo, ficaram sem `business_date` (o backfill de `daily_orders_board.sql` já preenche a grande maioria) usando o fuso de negócio, sem depender do fuso da sessão do banco.
**Alternativa**: agrupar por `paid_at` (caixa). Rejeitada: separa um pedido de sábado quitado no domingo do seu dia e diverge do quadro; o regime de caixa já está no resumo do caixa. Agrupar por `opened_at` (como `GET /sales`): rejeitada (dia do carrinho, fuso do banco).

### 2. Quais vendas entram em cada seção
**Decisão**:
- Faturamento (todas as quebras): `status = PAID`.
- `canceled`: `status = CANCELED AND business_date IS NOT NULL` (só pedidos finalizados recebem `business_date` no código novo; carrinhos cancelados em `OPEN` ficam de fora).
- `pending`: `status = PENDING AND business_date IS NOT NULL` — retrato no momento da consulta.
- `OPEN` sempre ignorado.
**Rationale**: receita só é o que foi recebido; cancelados e a receber aparecem à parte para o dono avaliar perdas e inadimplência do delivery sem distorcer o faturamento.

### 3. Agregação em SQL, uma consulta por seção
**Decisão**: novo `app/services/report_service.py` com `ReportService.sales_summary(db, start, end, top_limit, top_by) -> dict`. Um `select` base (`paid_sales` subquery/CTE com `id, report_date, order_type, total_amount, delivery_fee, delivery_zone_id, user_id`) reutilizado por:
1. `totals` + `by_channel`: `GROUP BY order_type` (`count`, `sum(total_amount)`, `sum(delivery_fee)`); `items_total` de cada canal = `gross − fees` (invariante de `delivery-zones-and-fee`) — evita join com itens. `totals` somado em Python a partir dos 3 canais; canal `order_type IS NULL` → `COUNTER`; canais ausentes preenchidos com zero.
2. `canceled`/`pending`: uma consulta `GROUP BY status` com `count`, `sum(total_amount)`.
3. `by_payment_method`: join `payments` → `GROUP BY method` (`sum(amount)`, `count(DISTINCT sale_id)`); preenche CASH/CARD/PIX.
4. `top_products`: join `sale_items` + `products` → `GROUP BY product_id, products.name` (`sum(quantity)`, `sum(subtotal)`, `count(DISTINCT sale_id)`), `ORDER BY` conforme `top_by` com desempates, `LIMIT top_limit`.
5. `by_day`: `GROUP BY report_date`; preenchimento de todos os dias do intervalo em Python.
6. `by_zone`: `WHERE order_type = DELIVERY`, `LEFT JOIN delivery_zones`, `GROUP BY delivery_zone_id, delivery_zones.name`; nulo → "Sem zona".
7. `by_operator`: join `users` → `GROUP BY user_id, users.name`.
Valores `Decimal` quantizados a `0.01` (`ROUND_HALF_UP`); `quantity` a `0.001`; `avg_ticket = gross / count` ou 0.
**Rationale**: 6–7 consultas agregadas e indexadas são triviais para o volume de um PDV, mantêm cada consulta simples/legível em SQLAlchemy 2.0 e evitam carregar ORM objects (diferente de `build_summary` do caixa, que agrega em Python por ser de um dia só).
**Alternativa**: carregar vendas com `selectinload` e agregar em Python. Rejeitada: período de até 1 ano pode ter dezenas de milhares de itens. Uma única consulta com `GROUPING SETS`: rejeitada (complexa de manter).

### 4. Canal no relatório
**Decisão**: `by_channel` usa `OrderTypeFilterEnum` (COUNTER/PICKUP/DELIVERY) de `daily-orders-board`, e **não** `SalesChannelEnum` (COUNTER/DELIVERY) do caixa, pois o relatório precisa separar Retirada de Entrega. A página pode somar PICKUP+DELIVERY para exibir "Delivery" quando quiser comparar com o caixa. Helper local `_channel_of(order_type) -> OrderTypeFilterEnum` (nulo → COUNTER).

### 5. API e schemas
**Decisão**: novo `app/routers/reports.py` (`APIRouter(prefix="/reports", tags=["reports"])`), `GET /sales-summary` com `Depends(require_admin)`; parâmetros `start_date: dt.date`, `end_date: dt.date`, `top_limit: int = Query(10, ge=1, le=50)`, `top_by: TopProductsOrderEnum = TopProductsOrderEnum.REVENUE`. Validação no router: `start > end` → 422 "A data inicial deve ser anterior ou igual à data final"; `(end − start).days + 1 > 366` → 422 "O período máximo do relatório é de 366 dias" (constante `MAX_REPORT_DAYS = 366`). Registrar em `main.py`.
Schemas em `app/schemas/schemas.py`: `TopProductsOrderEnum(str, Enum)` (`revenue`, `quantity`); `ReportTotals {paid_count, gross_total, items_total, delivery_fees_total, avg_ticket}`; `ReportCountTotal {count, total}`; `ReportPaymentMethod {method: PaymentMethodEnum, amount, count}`; `ReportChannel {channel: OrderTypeFilterEnum, count, gross_total, items_total, delivery_fees_total, avg_ticket}`; `ReportTopProduct {product_id, product_name, quantity, revenue, sales_count}`; `ReportDay {date, count, gross_total, items_total, delivery_fees_total}`; `ReportZone {zone_id: int | None, zone_name, count, delivery_fees_total, gross_total}`; `ReportOperator {user_id, user_name, count, gross_total}`; `SalesSummaryOut {start_date, end_date, generated_at, totals, canceled, pending, by_payment_method, by_channel, top_products, by_day, by_zone, by_operator}`. Dinheiro como `Decimal` (serializado como string, como no restante da API).
**Rationale**: um endpoint por página; contratos explícitos e testáveis; prefixo `/reports` deixa espaço para relatórios futuros.

### 6. `items_total` em `by_day`/`totals` sem join de itens
**Decisão**: `items_total = gross_total − delivery_fees_total` em todas as seções; `top_products.revenue` usa `sale_items.subtotal`.
**Rationale**: `total_amount = items_total + delivery_fee` é invariante persistido por `_recalculate_total`; evita dupla contagem do join venda×itens. A soma de `top_products` (completo) bate com `totals.items_total`.

### 7. Frontend — modelo, serviço e página
**Decisão**:
- `core/models/report.model.ts` (exportado no barrel `index.ts`): interfaces espelhando os schemas (`SalesSummary`, `ReportTotals`, …, `type TopProductsOrder = 'revenue' | 'quantity'`, `type ReportChannel = OrderTypeFilter`). Campos monetários tipados `number` como no restante dos models e convertidos com `Number()` no uso.
- `core/services/report.service.ts`: `getSalesSummary(startDate: string, endDate: string, opts?: { topLimit?: number; topBy?: TopProductsOrder }): Observable<SalesSummary>`.
- `core/utils/date-presets.ts`: funções puras `todayInSaoPaulo()`, `presetRange(preset, today)` retornando `{ start, end }` em `YYYY-MM-DD` para `TODAY`, `YESTERDAY`, `LAST_7_DAYS` (hoje e os 6 anteriores), `THIS_MONTH` (dia 1 até hoje), `LAST_MONTH`, `WEEKEND` (se hoje é sex/sáb/dom: sexta desta semana até hoje; senão sexta a domingo anteriores). Aritmética de datas em UTC sobre a string `YYYY-MM-DD` (sem fuso local).
- `core/utils/csv.ts`: `downloadCsv(filename, header: string[], rows: (string|number)[][])` — BOM `﻿`, `;`, números com vírgula (`toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false })`), escape de aspas, `Blob` + `URL.createObjectURL`.
- `pages/reports/reports.component.ts|html|scss` (standalone, signals): `startDate`, `endDate`, `activePreset`, `topBy`, `summary = signal<SalesSummary | null>`, `loading`, `error`; `rangeValid = computed(...)` (início ≤ fim e ≤ 366 dias); `load()` ao aplicar período/preset. Cards KPI (reaproveitando o padrão `.kpi-card` do Dashboard, movido/duplicado no SCSS da página): Faturamento, Pedidos pagos, Ticket médio, Taxas de entrega, A receber (count/valor), Cancelados (count/valor). Gráficos: barras+linha por dia (faturamento e nº de pedidos, eixo duplo), rosca por forma de pagamento, barras por canal (Balcão/Retirada/Entrega). `app-data-table` para Top produtos (com seletor Receita/Quantidade que recarrega com `topBy`), Zonas e Operadores. Botões "Exportar CSV" em "Faturamento por dia" e "Produtos mais vendidos".
- Charts: `@ViewChild` dos canvases; `effect()`/callback após `summary` mudar faz `destroy()` do gráfico anterior e recria; `ngOnDestroy` destrói todos. Estilo (fontes, cores, tooltip) extraído para `pages/reports/chart-theme.ts` com as cores já usadas no Dashboard (`#E05D53`, `#659A76`, `#3b82f6`). Estado vazio: quando `paid_count === 0`, esconder canvases e mostrar "Sem vendas no período".
- Rota `{ path: 'reports', component: ReportsComponent, canActivate: [adminGuard] }` em `app.routes.ts`; sidebar `{ icon: '◫', label: 'Relatórios', route: '/reports', adminOnly: true }` após "Caixa".
**Rationale**: funções de data e CSV puras são fáceis de verificar e reutilizáveis; seguir os padrões existentes (signals, standalone, data-table, adminGuard).

### 8. Dashboard: não migra; ajuste mínimo
**Decisão**: o Dashboard mantém a agregação no cliente. Esta change apenas adiciona o card `{ icon: '◫', label: 'Relatórios', description: 'Analisar vendas por período', route: '/reports', adminOnly: true }` e, por tocar o arquivo, remove `teste()` e o `console.log("sales: ", sales)`.
**Rationale**: o endpoint é ADMIN e o Dashboard é de todos; migrar exigiria um segundo endpoint não administrativo e a quebra por hora — não é trivial. Corrigir a data de referência do Dashboard (hoje usa `opened_at` e fuso do navegador) fica fora do escopo.
**Alternativa**: liberar `/reports/sales-summary` para operadores. Rejeitada: expõe faturamento de períodos e ranking de operadores.

## Risks / Trade-offs

- [Risco] Deploy antes de `daily_orders_board.sql` → colunas `business_date`/`paid_at` inexistentes. → Mitigação: pré-requisito declarado; esta change não tem SQL próprio e vem depois na sequência.
- [Trade-off] Pedido quitado em outro dia altera o relatório do dia do pedido (competência) e diverge do caixa do dia do recebimento. → Documentado na página (texto de ajuda "Valores por dia do pedido; pedidos pendentes não entram no faturamento").
- [Trade-off] Vendas legadas canceladas ainda em `OPEN` receberam `business_date` no backfill e contam em `canceled`. → Aceito (apenas histórico anterior à change).
- [Trade-off] `product_name` é o nome atual do produto; `user_name` idem. → Aceito (mesma decisão de `daily-orders-board`).
- [Risco] Vendas legadas com soma de pagamentos ≠ `total_amount` quebrariam a igualdade `sum(by_payment_method) = gross_total`. → `finalize_sale` sempre exigiu soma exata; a página exibe os valores do backend sem recalcular.
- [Risco] Período de 366 dias com muitos dias no gráfico. → Barras finas; aceitável. Agrupamento semanal/mensal fica para o futuro.
- [Risco] Datas do preset calculadas com o relógio do navegador. → Uso explícito de `America/Sao_Paulo`; a hora de virada (`BUSINESS_DAY_CUTOFF_HOUR`) não é aplicada nos presets — "Hoje" de madrugada mostra o dia do calendário (documentado; com virada 0 é idêntico).

## Migration Plan

1. Confirmar que `daily-orders-board` (e seus pré-requisitos) estão implantados e `daily_orders_board.sql` foi executado.
2. Deploy do backend (novo router; sem SQL), depois do frontend.
3. Verificar: `GET /reports/sales-summary` de hoje como ADMIN (200) e OPERATOR (403); comparar `totals` com o resumo do caixa do dia.

**Rollback**: remover router/página; não há alterações de dados.
