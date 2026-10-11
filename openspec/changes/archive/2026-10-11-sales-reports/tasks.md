## 1. Pré-requisitos

- [x] 1.1 Confirmar que `customer-registry`, `delivery-zones-and-fee`, `single-cash-register` e `daily-orders-board` estão implementadas (`Sale.delivery_fee`, `Sale.delivery_zone_id`, `Sale.business_date`, `Sale.paid_at`, `OrderTypeFilterEnum`, `Settings.BUSINESS_TIMEZONE`) e que `daily_orders_board.sql` foi executado (índice `ix_sales_business_date` presente)

## 2. Backend — schemas

- [x] 2.1 Em `pdv_API/app/schemas/schemas.py`: `TopProductsOrderEnum` (`revenue`, `quantity`)
- [x] 2.2 Criar `ReportTotals`, `ReportCountTotal`, `ReportPaymentMethod`, `ReportChannel` (usa `OrderTypeFilterEnum`), `ReportTopProduct`, `ReportDay`, `ReportZone`, `ReportOperator` e `SalesSummaryOut` (design, decisão 5), com dinheiro em `Decimal`

## 3. Backend — ReportService

- [x] 3.1 Criar `pdv_API/app/services/report_service.py` com a expressão `report_date` (`COALESCE(business_date, timezone(tz, COALESCE(paid_at, closed_at, opened_at))::date)`) e o filtro de período indexável (decisão 1), aplicando fallback só a `PAID`
- [x] 3.2 Implementar `totals` + `by_channel` (`GROUP BY order_type`, nulo → COUNTER, 3 canais sempre presentes, `items_total = gross − fees`, `avg_ticket` com divisão segura)
- [x] 3.3 Implementar `canceled` e `pending` (`status IN (CANCELED, PENDING) AND business_date IS NOT NULL`)
- [x] 3.4 Implementar `by_payment_method` (join `payments`, `sum(amount)`, `count(DISTINCT sale_id)`, sempre CASH/CARD/PIX nessa ordem)
- [x] 3.5 Implementar `top_products` (join `sale_items` + `products`, `sum(quantity)`, `sum(subtotal)`, `count(DISTINCT sale_id)`, ordenação por `top_by` com desempates, `LIMIT top_limit`)
- [x] 3.6 Implementar `by_day` (`GROUP BY report_date`) preenchendo todos os dias do intervalo com zeros
- [x] 3.7 Implementar `by_zone` (somente DELIVERY, `LEFT JOIN delivery_zones`, nulo → "Sem zona") e `by_operator` (join `users`), ordenados por `gross_total` desc
- [x] 3.8 Quantizar valores (`0.01` dinheiro, `0.001` quantidade, `ROUND_HALF_UP`) e montar o dict de `SalesSummaryOut` com `generated_at`

## 4. Backend — router

- [x] 4.1 Criar `pdv_API/app/routers/reports.py` (`prefix="/reports"`), `GET /sales-summary` com `Depends(require_admin)`, `top_limit` (`Query(10, ge=1, le=50)`) e `top_by`
- [x] 4.2 Validar período no router: início > fim → 422 "A data inicial deve ser anterior ou igual à data final"; mais de `MAX_REPORT_DAYS = 366` dias → 422 "O período máximo do relatório é de 366 dias"
- [x] 4.3 Registrar o router em `pdv_API/main.py`
- [ ] 4.4 Testar no Swagger (`/docs`): 200 como ADMIN, 403 como OPERATOR, 401 sem token, 422 para período inválido e `top_limit=0`

## 5. Frontend — modelos, serviço e utilitários

- [x] 5.1 Criar `pdv_View/src/app/core/models/report.model.ts` (interfaces do `SalesSummaryOut`, `TopProductsOrder`) e exportar no barrel `core/models/index.ts`
- [x] 5.2 Criar `core/services/report.service.ts` com `getSalesSummary(startDate, endDate, opts?)`
- [x] 5.3 Criar `core/utils/date-presets.ts` (`todayInSaoPaulo`, `presetRange` para TODAY, YESTERDAY, LAST_7_DAYS, THIS_MONTH, LAST_MONTH, WEEKEND) com aritmética sobre `YYYY-MM-DD` em UTC
- [x] 5.4 Criar `core/utils/csv.ts` (`downloadCsv` com BOM, `;`, vírgula decimal, escape de aspas)

## 6. Frontend — página Relatórios

- [x] 6.1 Criar `pages/reports/reports.component.ts|html|scss` (standalone, signals): filtros de data, botões de preset (preset inicial "Hoje"), `rangeValid` com mensagem de período inválido, `load()`, estados de carregamento/erro
- [x] 6.2 Cards KPI: Faturamento, Pedidos pagos, Ticket médio, Taxas de entrega, A receber (qtd/valor), Cancelados (qtd/valor), formatados em `pt-BR`/BRL; texto de ajuda sobre dia do pedido e pendentes
- [x] 6.3 Criar `pages/reports/chart-theme.ts` (fontes, cores e tooltip do Dashboard) e os gráficos: por dia (barras de faturamento + linha de pedidos, eixo duplo), rosca por forma de pagamento, barras por canal (Balcão/Retirada/Entrega); destruir/recriar ao recarregar e destruir no `ngOnDestroy`
- [x] 6.4 Estado vazio dos gráficos ("Sem vendas no período") quando `paid_count === 0`
- [x] 6.5 Tabelas com `app-data-table`: Produtos mais vendidos (seletor Receita/Quantidade recarregando com `topBy`), Entregas por zona e Por operador
- [x] 6.6 Botões "Exportar CSV" em "Faturamento por dia" (`Data;Pedidos;Faturamento;Itens;Taxas de entrega`) e "Produtos mais vendidos" (`Produto;Quantidade;Receita;Vendas`), nome `<tipo>_<inicio>_<fim>.csv`
- [x] 6.7 Layout responsivo (KPIs e gráficos em grid que empilha < 1024px) usando tokens de `src/styles.scss`

## 7. Frontend — navegação e Dashboard

- [x] 7.1 Em `app.routes.ts`: rota `reports` com `canActivate: [adminGuard]`
- [x] 7.2 Em `shared/components/sidebar/sidebar.component.ts`: item `{ icon: '◫', label: 'Relatórios', route: '/reports', adminOnly: true }` após "Caixa"
- [x] 7.3 Em `pages/dashboard/dashboard.component.ts`: adicionar card "Relatórios" (`adminOnly`), remover o método `teste()` e o `console.log("sales: ", sales)`

## 8. Testes manuais

- [x] 8.1 Montar dados: vendas pagas de Balcão, Retirada e Entrega (com zona e sem zona), pagamento misto, um pedido PENDING, um cancelado após finalizar e um carrinho OPEN
- [x] 8.2 Conferir `totals`: só PAID; `gross_total = items_total + delivery_fees_total`; `sum(by_payment_method.amount) = gross_total`; `sum(by_day) = totals`; cancelados e pendentes separados; OPEN ausente
- [x] 8.3 Conferir `by_channel` (3 canais), `top_products` com `top_by=revenue` e `quantity`, `by_zone` ("Sem zona") e `by_operator`
- [x] 8.4 Com `BUSINESS_DAY_CUTOFF_HOUR=4`, venda paga às 01:30 aparece no dia anterior; pedido PENDING de ontem quitado hoje conta em ontem
- [x] 8.5 Comparar o relatório de hoje com o resumo do caixa do dia (`GET /cash-registers/{id}/summary`) — mesmos totais por forma de pagamento quando não há quitações de dias anteriores
- [ ] 8.6 Página: cada preset (incluindo "Fim de semana" num dia útil e num sábado), período inválido bloqueado, período sem vendas, troca Receita/Quantidade, exportações CSV abertas no Excel com acentos e decimais corretos
- [ ] 8.7 Como OPERATOR: item "Relatórios" ausente no sidebar e no Dashboard; `/reports` redireciona ao Dashboard
- [ ] 8.8 Dashboard continua funcionando sem logs no console
- [x] 8.9 `ng build` sem erros
