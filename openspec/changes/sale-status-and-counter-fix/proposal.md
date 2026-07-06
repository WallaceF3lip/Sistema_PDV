## Why

Dois bugs foram identificados no fluxo de checkout após a extração para o `CheckoutModalComponent`: (1) pedidos de Entrega e Retirada que serão pagos depois estão sendo salvos com status `PAID` no banco, quando deveriam ficar como `PENDING`; (2) vendas do tipo Balcão não persistem `customer_name` nem `notes` porque o fluxo de Balcão pula a etapa de detalhes e vai direto para pagamento sem chamar `PATCH /order-details`.

## What Changes

- **Backend**: adicionar status `PENDING` ao `SaleStatusEnum` para representar pedidos reservados (entrega/retirada com pagamento posterior)
- **Backend**: `finalize_sale` usa `SaleStatusEnum.PENDING` (em vez de `PAID`) quando `is_reservation = True`; mantém `PAID` para todos os outros casos
- **Backend**: migração Alembic para adicionar o novo valor ao enum `salestatusenum` no PostgreSQL
- **Backend**: `cancel_sale` passa a aceitar cancelamento de vendas `PENDING` (atualmente só aceita `OPEN` e `PAID`)
- **Frontend**: `SaleStatusEnum` no modelo Angular recebe o novo valor `PENDING`
- **Frontend**: em `advanceStep()` no `CheckoutModalComponent`, quando o tipo é Balcão, salvar `customer_name`, `notes` e `order_type: null` via `PATCH /order-details` antes de inicializar as entradas de pagamento

## Capabilities

### New Capabilities
- `sale-pending-status`: Status intermediário `PENDING` para pedidos reservados aguardando pagamento

### Modified Capabilities

## Impact

- **Backend**: `app/models/sale.py` (novo valor no enum), `app/services/sale_service.py` (lógica de status na finalização e cancelamento), migração Alembic
- **Frontend**: `pdv_View/src/app/core/models/sale.model.ts` (novo valor no `SaleStatusEnum`), `sale-checkout-modal.component.ts` (chamar `updateOrderDetails` no fluxo Balcão)
- **Banco de dados**: ALTER TYPE no enum `salestatusenum` via migração Alembic
