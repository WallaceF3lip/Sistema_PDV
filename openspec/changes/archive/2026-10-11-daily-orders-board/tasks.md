## 1. Pré-requisitos e migração SQL

- [x] 1.1 Confirmar que `customer-registry`, `delivery-zones-and-fee` e `single-cash-register` estão implementadas (`Sale.items_total`, `Sale.delivery_zone_name`, `Sale.cash_register_id`, `CashRegisterService.register_sale_payments`/`require_open_register`/`register_sale_cancellation`) e que `single_cash_register.sql` foi executado
- [x] 1.2 Criar `pdv_API/migrations/daily_orders_board.sql` com cabeçalho (executar após `single_cash_register.sql`, antes do deploy), em `BEGIN/COMMIT`, com guarda de `sales.cash_register_id`
- [x] 1.3 No script: colunas `sales.paid_at`, `sales.business_date`, `sales.daily_number` (`IF NOT EXISTS`), índice `ix_sales_business_date` e índice único parcial `ux_sales_business_date_daily_number`
- [x] 1.4 No script: tabela `daily_order_counters (business_date DATE PK, last_number INTEGER NOT NULL CHECK >= 0)`
- [x] 1.5 No script: backfill `paid_at = closed_at` para `PAID` e `business_date = (closed_at AT TIME ZONE 'America/Sao_Paulo')::date` para status ≠ `OPEN`
- [x] 1.6 Executar o script duas vezes em base de desenvolvimento e confirmar idempotência

## 2. Backend — configuração e dia de operação

- [x] 2.1 Adicionar `tzdata` a `pdv_API/requirements.txt`
- [x] 2.2 Em `app/core/config.py`: `BUSINESS_TIMEZONE: str = "America/Sao_Paulo"` e `BUSINESS_DAY_CUTOFF_HOUR: int = 0` (validar 0–23)
- [x] 2.3 Criar `app/core/business_day.py` com `business_date_for(moment=None) -> date` e `current_business_date() -> date` (zoneinfo + virada)
- [x] 2.4 Verificar manualmente (REPL) os três cenários da spec `sale-daily-number` (meia-noite, cutoff 4, servidor UTC)

## 3. Backend — models e schemas

- [x] 3.1 Em `app/models/sale.py`: colunas `paid_at`, `business_date` (index), `daily_number`; `__table_args__` com `Index('ux_sales_business_date_daily_number', 'business_date', 'daily_number', unique=True, postgresql_where=daily_number.isnot(None))`
- [x] 3.2 Em `app/models/sale.py`: propriedade `SaleItem.product_name` e model `DailyOrderCounter` (`daily_order_counters`); exportar em `app/models/__init__.py`
- [x] 3.3 Em `app/schemas/schemas.py`: `SaleItemOut.product_name`; `SaleOut.daily_number`, `business_date`, `paid_at`
- [x] 3.4 Criar `SettleSaleRequest` (`payments` 1–3), `OrderTypeFilterEnum` (COUNTER/PICKUP/DELIVERY), `BoardStatusCount`, `BoardTypeCount`, `SalesBoardOut`

## 4. Backend — SaleService

- [x] 4.1 `_next_daily_number(db, business_date)` com `INSERT ... ON CONFLICT DO UPDATE ... RETURNING last_number` (dialeto postgresql)
- [x] 4.2 `finalize_sale`: atribuir `business_date`/`daily_number` imediatamente antes do `commit` (após caixa, estoque e pagamentos); gravar `paid_at = closed_at` quando `PAID`
- [x] 4.3 `settle_sale(db, sale_id, payments, user_id)`: lock da venda (`with_for_update`), validações 404/400/422, criação de `Payment`s, `flush`, `register_sale_payments`, `status=PAID`, `is_paid=True`, `paid_at`, `commit`; rollback em erro
- [x] 4.4 `cancel_sale`: carregar a venda com `with_for_update()` antes de verificar o status (ordem de locks venda → caixa)
- [x] 4.5 `get_board(db, business_date)`: consulta por `business_date` e status PENDING/PAID/CANCELED com `selectinload` (items→product, payments, delivery_zone), ordenada por `daily_number, id`; montar `status_counts` e `type_counts` (sempre completos)

## 5. Backend — router `/sales`

- [x] 5.1 `GET /sales/board?date=` declarado **antes** de `GET /{sale_id}`, padrão `current_business_date()`, resposta `SalesBoardOut`
- [x] 5.2 `POST /sales/{sale_id}/settle` (`get_current_user`) → `SaleService.settle_sale`, resposta `SaleOut`
- [x] 5.3 `GET /sales`: filtros opcionais `status` e `order_type` (`COUNTER` ⇔ `order_type IS NULL`) e eager loading de itens/produtos/pagamentos
- [ ] 5.4 Testar via `/docs`: finalizar 2 vendas (números consecutivos), finalização com 422 não consome número, quitar `PENDING` (movimento `SALE` no caixa, `paid_at`), quitar `PAID` (400), quitar sem caixa (409), valor divergente (422), `GET /sales/board` e `?date=` inválida (422)
- [ ] 5.5 Testar concorrência: duas quitações simultâneas do mesmo pedido (ex.: dois `curl` em paralelo) → uma 200 e uma 400; duas finalizações simultâneas → números distintos

## 6. Frontend — modelos, serviços e interceptor

- [x] 6.1 `core/models/sale.model.ts`: `SaleItem.product_name`; `Sale.daily_number`, `business_date`, `paid_at`; `OrderTypeFilter`, `SettleSaleRequest`, `BoardStatusCount`, `BoardTypeCount`, `SalesBoard`, `SaleListFilters`, `PaymentEntry` (movido do checkout), `PaymentEntryState`
- [x] 6.2 Criar `core/utils/sale-label.ts` com `saleLabel(sale)` ("Pedido #N" / "Venda #id")
- [x] 6.3 Criar `core/interceptors/silent-error.token.ts` (`SILENT_ERROR`) e fazer `error.interceptor.ts` pular o toast quando o token for true (mantendo logout em 401)
- [x] 6.4 `core/services/sale.service.ts`: `settle(saleId, req, opts?)`, `getBoard(date?, opts?: { silent?: boolean })`, `list(startDate, endDate, filters?)`
- [x] 6.5 Criar `core/services/print.service.ts` stub (`canPrint(): false`, `printOrderTicket(sale: Sale): void` no-op) — pular se `order-ticket-printing` já tiver criado o serviço

## 7. Frontend — componente de pagamento compartilhado

- [x] 7.1 Criar `shared/components/payment-entry/` (`app-payment-entry`): inputs `total`, `initialMethod`, `maxEntries`; output `stateChange: PaymentEntryState`; mover lógica (`paymentEntries`, restante, troco, adicionar/remover, até 3) e estilos do bloco de pagamento do checkout
- [x] 7.2 Normalizar `payments`: descontar o troco da entrada CASH, remover entradas ≤ 0, arredondar a 2 casas, soma == total
- [x] 7.3 Substituir a etapa PAYMENT de `pages/sales/sale-checkout-modal` pelo componente (finalização usa `state.payments`/`state.valid`); remover código duplicado
- [ ] 7.4 Verificar no checkout: pagamento único, misto e em dinheiro com troco (antes 422, agora finaliza)

## 8. Frontend — página Pedidos do Dia

- [x] 8.1 Criar `pages/orders/orders.component.ts|html|scss` com signals de estado, `computed` de grupos (A receber/Pagos/Cancelados), chips por tipo com contagem e busca por número/nome/telefone
- [x] 8.2 Ordenação: pendentes por `delivery_time` (HH:MM válido, inválido/nulo ao final, desempate por número); pagos/cancelados por número decrescente; destaque "Atrasado" (horário de Brasília, só no dia atual)
- [x] 8.3 Cartão: `saleLabel`, badge do tipo, cliente, telefone, horário, endereço/zona/taxa (Entrega), total, forma prevista ou formas pagas, itens (qtd × `product_name`), observação
- [x] 8.4 Polling 15 s com `timer` + `visibilitychange` + `exhaustMap` + `takeUntilDestroyed`, silencioso, pausado com aba oculta ou data diferente da atual; botão "Atualizar", "Atualizado às HH:mm" e indicador de falha
- [x] 8.5 Seletor de data (padrão = `business_date` retornado pelo servidor)
- [x] 8.6 Modal "Receber": total, `app-payment-entry` com `initialMethod = delivery_payment_method`, chama `settle` com `SILENT_ERROR`, erro inline com `detail`, recarrega em sucesso/400, toast de sucesso
- [x] 8.7 Modal de cancelamento com número/total e aviso de estorno para PAID; chama `cancel` e recarrega
- [x] 8.8 Botão "Reimprimir" visível só se `printService.canPrint()`, chamando `printOrderTicket(sale)`
- [x] 8.9 Layout responsivo: 3 colunas ≥1024px (Cancelados recolhido), abas abaixo; sem rolagem horizontal em 360px
- [x] 8.10 Rota `orders` em `app.routes.ts` e item `{ icon: '▣', label: 'Pedidos do Dia', route: '/orders' }` no sidebar após "Vendas"

## 9. Frontend — histórico de vendas

- [x] 9.1 Em `pages/sales-history`: coluna "#" exibe `saleLabel(sale)` e filtro de produto passa a usar `item.product_name` (case-insensitive), conforme spec `sales-history-view`

## 10. Testes manuais (fim de semana simulado)

- [ ] 10.1 Com caixa aberto, finalizar 1 Balcão pago, 1 Retirada pendente e 1 Entrega pendente com zona → quadro mostra Pedidos #1–#3 nos grupos corretos, chips com contagem 1/1/1
- [ ] 10.2 Em outra aba/terminal finalizar novo pedido → aparece no quadro em ≤ 15 s; trocar de aba e confirmar no DevTools que o polling pausa
- [ ] 10.3 Receber a Entrega com R$ 100 em dinheiro → troco exibido, pedido vai para "Pagos", resumo do caixa mostra a venda no canal Delivery
- [ ] 10.4 Receber com caixa fechado → mensagem no modal; cancelar pedido pago com caixa aberto → vai para "Cancelados" com o mesmo número e estorno no caixa
- [ ] 10.5 Pedido pendente com horário passado exibe "Atrasado"; filtro "Entrega" e busca por telefone funcionam durante o polling
- [ ] 10.6 Derrubar o backend → quadro mantém pedidos, mostra falha sem toasts repetidos; religar → volta a atualizar
- [ ] 10.7 Botão "Reimprimir" oculto enquanto `PrintService.canPrint()` for false
- [ ] 10.8 Testar a página em largura de celular (abas, sem rolagem horizontal)
