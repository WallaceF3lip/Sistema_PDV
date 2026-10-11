## Why

Hoje cada usuário abre o seu próprio caixa (`cash_registers` permite um OPEN por usuário, vários ao mesmo tempo), as vendas não ficam vinculadas a nenhum caixa e nenhum movimento `SALE` é criado — o saldo do caixa só reflete abertura, sangria e suprimento, e o fechamento não diz quanto foi vendido, nem separa o movimento de Balcão do de Delivery. O estabelecimento opera com **um único caixa compartilhado** por todos os operadores e precisa, no fechamento, conferir o dinheiro da gaveta e ver os totais separados por **Balcão vs Delivery (Retirada + Entrega)**. Com a taxa de entrega já compondo o total da venda (change `delivery-zones-and-fee`, **pré-requisito**), o caixa passa a ser a base da conferência diária e do quadro de pedidos (`daily-orders-board`).

## What Changes

- **Pré-requisitos**: `customer-registry` e `delivery-zones-and-fee` implementadas (`Sale.total_amount` = `items_total` + `delivery_fee`; script `add_delivery_zones.sql` executado).
- **BREAKING** Caixa único global: no máximo **um** `CashRegister` com status `OPEN` no sistema (índice único parcial no banco + verificação no serviço). Qualquer usuário autenticado (ADMIN ou OPERATOR) pode abrir o caixa quando não há nenhum aberto; todos os operadores vendem no mesmo caixa. Sangria, suprimento e fechamento continuam restritos a ADMIN.
- Novo `GET /cash-registers/current` (retorna o caixa aberto ou `null`, sem erro). `GET /cash-registers/my-open` é mantido como alias **depreciado** que retorna o caixa compartilhado (404 se não houver).
- `CashRegisterOut` ganha `opened_by_name` e `closed_by_name`; nova coluna `cash_registers.closed_by_user_id`.
- Nova coluna `sales.cash_register_id` (FK nullable): preenchida na finalização (PAID e PENDING) e, no futuro, ao quitar um pedido PENDING.
- **BREAKING** `POST /sales/{id}/finalize` exige caixa aberto (409 "Nenhum caixa aberto…"), inclusive para reservas PENDING.
- Novo serviço reutilizável `CashRegisterService.register_sale_payments(db, sale, payments, user_id)`: vincula a venda ao caixa aberto e cria um `CashMovement` `SALE` por pagamento; usado pela finalização e pelo futuro `POST /sales/{id}/settle` (`daily-orders-board`).
- `cash_movements` ganha `payment_method` (nullable, enum de pagamento) e `sale_id` (FK nullable). Movimentos `SALE` são criados para **todas** as formas (CASH, CARD, PIX); o saldo da gaveta (`current_balance`, sangria, fechamento) considera somente dinheiro.
- Novo tipo de movimento `SALE_CANCEL` (estorno): cancelar uma venda PAID cria um estorno por pagamento no caixa **aberto no momento** do cancelamento; cancelar venda PAID sem caixa aberto é bloqueado (409). Cancelar venda OPEN/PENDING não gera movimento.
- Novo `GET /cash-registers/{id}/summary`: totais por forma de pagamento, por canal `COUNTER` (Balcão, `order_type` nulo) vs `DELIVERY` (Retirada + Entrega), total de taxas de entrega, quantidade de vendas, estornos, pedidos pendentes vinculados e dinheiro esperado na gaveta.
- Novo `GET /cash-registers/` (ADMIN): histórico paginado de caixas com filtro por período e status.
- Frontend: página Caixa mostra o caixa compartilhado (quem abriu e quando), resumo Balcão vs Delivery e por forma de pagamento, fechamento com dinheiro esperado e diferença, e aba "Histórico" (ADMIN) com o resumo de caixas anteriores. A tela de Vendas e o checkout bloqueiam a finalização sem caixa aberto, com mensagem clara e atalho para a página Caixa.
- Script `pdv_API/migrations/single_cash_register.sql`, executado **após** `add_delivery_zones.sql` e antes do deploy do backend: valor de enum, novas colunas, índices e correção de caixas abertos simultâneos já existentes.

## Capabilities

### New Capabilities
- `cash-register-single`: Caixa único compartilhado do estabelecimento — abertura (qualquer usuário), consulta do caixa atual, guarda de unicidade, vínculo das vendas ao caixa na finalização/quitação, movimentos de venda por forma de pagamento, estorno no cancelamento, saldo de gaveta somente em dinheiro, fechamento e histórico administrativo; bloqueio da finalização sem caixa aberto no frontend.
- `cash-register-channel-summary`: Resumo do caixa (`GET /cash-registers/{id}/summary`) com totais por forma de pagamento, por canal Balcão vs Delivery, taxas de entrega, contagens e dinheiro esperado, exibido na página Caixa e no histórico.

### Modified Capabilities
<!-- Nenhuma: não há specs de caixa ou de venda arquivadas em openspec/specs/ (apenas data-table-pagination e sales-history-view, cujos requisitos não mudam). -->

## Impact

- **Backend**: `app/models/cash_register.py` (`SALE_CANCEL`, `CashMovement.payment_method`/`sale_id`, `CashRegister.closed_by_user_id`, propriedades `opened_by_name`/`closed_by_name`); `app/models/sale.py` (`cash_register_id` + relação); `app/schemas/schemas.py` (`CashRegisterOut`, `CashMovementOut`, novos `CashRegisterSummaryOut`, `CashRegisterListItem`, `CashRegisterPage`); `app/services/cash_register_service.py` (unicidade, `get_current_register`, `require_open_register`, `register_sale_payments`, `register_sale_cancellation`, `get_cash_balance`, `build_summary`, `list_registers`); `app/routers/cash_registers.py`; `app/services/sale_service.py` (`finalize_sale`, `cancel_sale`).
- **Banco de dados**: novo `pdv_API/migrations/single_cash_register.sql` (depende de `add_delivery_zones.sql`); `ALTER TYPE cashmovementtypeenum ADD VALUE` fora de transação.
- **API**: finalização sem caixa aberto passa a retornar 409; cancelamento de venda PAID sem caixa aberto retorna 409; `CashMovementOut`/`CashRegisterOut` ganham campos (aditivo); abrir caixa quando já existe um aberto (de qualquer usuário) retorna 409.
- **Frontend**: `core/models/cash-register.model.ts`, `core/services/cash-register.service.ts`; `pages/cash-register/*` (caixa compartilhado, resumo, histórico); `pages/sales/sales.component.ts`/`sales.html` (aviso e bloqueio); `pages/sales/sale-checkout-modal` (tratamento do 409).
- **Changes futuras**: `daily-orders-board` chama `register_sale_payments` no `POST /sales/{id}/settle`; `sales-reports` pode reutilizar a classificação de canal.
