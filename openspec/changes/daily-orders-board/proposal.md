## Why

Em fins de semana movimentados o operador precisa enxergar, em uma única tela, todos os pedidos do dia (Balcão, Retirada e Entrega) e saber o que ainda falta receber. Hoje o histórico de vendas (`/sales-history`) é uma tabela de consulta sem ações: não há como quitar um pedido `PENDING` (o backend não tem endpoint para isso), os pedidos não têm um número curto para chamar o cliente/conferir com o motoboy, e os itens aparecem só como `product_id`.

## What Changes

- Novo endpoint `POST /sales/{id}/settle` (body `{ payments: PaymentIn[] }`): quita um pedido `PENDING` → `PAID`, exige soma dos pagamentos igual a `total_amount` (itens + taxa de entrega), exige caixa aberto e registra os movimentos `SALE` via `CashRegisterService.register_sale_payments` (change `single-cash-register`). Grava `is_paid = true` e o novo `paid_at`.
- Nova coluna `sales.paid_at` (momento do recebimento), preenchida na finalização `PAID` e na quitação; `closed_at` mantém o significado atual.
- Número sequencial do pedido por dia de operação: novas colunas `sales.business_date` e `sales.daily_number`, atribuídas na **finalização** (OPEN → PAID/PENDING) a partir de um contador por dia (`daily_order_counters`), seguro para concorrência e sem lacunas; exibido como "Pedido #N". Dia de operação calculado em `America/Sao_Paulo` com hora de virada configurável (`BUSINESS_DAY_CUTOFF_HOUR`, padrão 0).
- `SaleItemOut.product_name` (nome do produto no item) e `SaleOut` com `daily_number`, `business_date`, `paid_at`.
- Novo endpoint `GET /sales/board?date=YYYY-MM-DD` com os pedidos finalizados do dia de operação (PENDING/PAID/CANCELED) e contagens por status e por tipo; `GET /sales` ganha filtros opcionais `status` e `order_type` (`COUNTER`/`PICKUP`/`DELIVERY`).
- `cancel_sale` passa a bloquear a linha da venda (`FOR UPDATE`) para não concorrer com uma quitação simultânea.
- Nova página `/orders` "Pedidos do Dia": colunas por status (A receber / Pagos / Cancelados; abas em telas estreitas), chips por tipo (Todos/Balcão/Retirada/Entrega) com contagem, busca, cartões com Pedido #, cliente, telefone, tipo, horário, zona, total, forma de pagamento prevista, resumo de itens e destaque de atraso; atualização automática a cada ~15 s (pausada com a aba oculta). Ações: Receber (modal de pagamento), Cancelar (confirmação) e Reimprimir comanda.
- Extração do bloco de pagamento do checkout para o componente compartilhado `app-payment-entry`, reutilizado no checkout e no modal de quitação; o valor enviado em dinheiro passa a descontar o troco (corrige 422 quando o cliente paga com nota maior).
- Contrato de impressão `PrintService` (`canPrint()`, `printOrderTicket(sale)`): esta change cria um stub (`canPrint() = false`, botão Reimprimir oculto) que a change `order-ticket-printing` implementa.
- Item "Pedidos do Dia" no sidebar; histórico de vendas passa a exibir o Pedido # e a filtrar por nome do produto (já exigido pela spec `sales-history-view`).
- Script `pdv_API/migrations/daily_orders_board.sql` (executar após `single_cash_register.sql`).

## Capabilities

### New Capabilities
- `daily-orders-board`: Quadro operacional dos pedidos do dia (endpoint `GET /sales/board`, filtros de `GET /sales`, nomes de produto nos itens, página `/orders` com filtros, polling e ações de receber/cancelar/reimprimir).
- `sale-settlement`: Quitação de pedidos `PENDING` via `POST /sales/{id}/settle`, com validação de valor, exigência de caixa aberto, movimentos de caixa, `paid_at` e proteção contra quitação/cancelamento concorrentes.
- `sale-daily-number`: Numeração sequencial de pedidos por dia de operação (`business_date`, `daily_number`) atribuída na finalização, única e sem lacunas.

### Modified Capabilities
<!-- Nenhuma: `sales-history-view` já exige filtro por nome de produto; esta change apenas fornece o dado (`product_name`). As capacidades de caixa/checkout ainda não estão arquivadas em openspec/specs/. -->

## Impact

- **Pré-requisitos**: changes `customer-registry`, `delivery-zones-and-fee` e `single-cash-register` implementadas (`total_amount` = itens + taxa, `items_total`, `delivery_zone_name`, `Sale.cash_register_id`, `register_sale_payments`, `require_open_register`).
- **Backend**: `app/models/sale.py` (colunas `paid_at`, `business_date`, `daily_number`, propriedade `SaleItem.product_name`), novo model `DailyOrderCounter`; `app/core/config.py` (`BUSINESS_DAY_CUTOFF_HOUR`) e novo `app/core/business_day.py`; `app/schemas/schemas.py` (`SettleSaleRequest`, `OrderTypeFilterEnum`, `SalesBoardOut` e afins, campos novos em `SaleOut`/`SaleItemOut`); `app/services/sale_service.py` (`finalize_sale`, `settle_sale`, `get_board`, `cancel_sale`); `app/routers/sales.py` (`/board` antes de `/{sale_id}`, `/settle`, filtros). `requirements.txt` + `tzdata`.
- **Banco de dados**: `pdv_API/migrations/daily_orders_board.sql` — obrigatório antes do deploy do backend.
- **Frontend**: `core/models/sale.model.ts`, `core/services/sale.service.ts` (`settle`, `getBoard`, filtros em `list`), novo `core/services/print.service.ts` (stub/contrato), novo `shared/components/payment-entry`, `pages/sales/sale-checkout-modal` (usa o componente), nova página `pages/orders`, `app.routes.ts`, sidebar, `pages/sales-history`.
- **Mudanças futuras**: `order-ticket-printing` implementa `PrintService` e usa `daily_number`/`product_name`; `sales-reports` pode usar `business_date`, `paid_at` e os filtros de `GET /sales`.
