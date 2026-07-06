## Why

O fluxo de venda atual não captura informações do pedido além dos itens e pagamento. Para suportar reservas e entregas — casos comuns no varejo local — é necessário registrar dados do cliente, observações, tipo de pedido (retirada ou entrega) e, quando for entrega, dados logísticos como horário, endereço, telefone e forma de pagamento (com possibilidade de marcar como já pago).

## What Changes

- Novo campo `customer_name` na venda (nome do cliente, opcional)
- Novo campo `notes` na venda (observação livre, opcional)
- Novo campo `order_type` na venda: `PICKUP` (retirada) ou `DELIVERY` (entrega/reserva)
- Campos condicionais para pedidos de entrega:
  - `delivery_time` — horário previsto para entrega
  - `delivery_address` — endereço de entrega
  - `customer_phone` — telefone de contato
  - `payment_method` — forma de pagamento para reserva
  - `is_paid` — flag indicando se já está pago
- A finalização de vendas do tipo `DELIVERY` não exige pagamento imediato (pedido pode ser reservado)
- Backend: modelo `Sale` e schemas atualizados; novo endpoint `PATCH /{sale_id}/order-details` para salvar os dados sem finalizar
- Frontend: painel de detalhes do pedido no carrinho, com campos condicionais exibidos quando tipo = `DELIVERY`

## Capabilities

### New Capabilities
- `sale-order-details`: Captura e persistência de dados do pedido (cliente, observação, tipo de pedido e campos de entrega)

### Modified Capabilities

## Impact

- **Backend**: `app/models/sale.py` (novas colunas), `app/schemas/schemas.py` (novos campos em `SaleOut` e novo request schema), `app/routers/sales.py` (novo endpoint PATCH), `app/services/sale_service.py` (nova lógica de update e finalização flexível para DELIVERY)
- **Banco de dados**: migração Alembic para adicionar colunas à tabela `sales`
- **Frontend**: `sales.component.ts`, `sales.html`, `sales.scss` — novo painel de detalhes integrado ao carrinho
- **Modelos Angular**: interface `Sale` atualizada com novos campos
