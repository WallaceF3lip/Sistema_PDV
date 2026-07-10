## 1. Backend — Modelo e Migração

- [ ] 1.1 Adicionar campos `customer_name`, `notes`, `order_type`, `delivery_time`, `delivery_address`, `customer_phone`, `payment_method`, `is_paid` ao modelo `Sale` em `app/models/sale.py`
- [ ] 1.2 Adicionar enum `OrderTypeEnum` com valores `PICKUP` e `DELIVERY` em `app/models/sale.py`
- [ ] 1.3 Gerar migração Alembic: `alembic revision --autogenerate -m "add order details to sales"`
- [ ] 1.4 Revisar o arquivo de migração gerado e garantir que todas as novas colunas são `nullable=True`

## 2. Backend — Schemas

- [ ] 2.1 Criar schema `UpdateOrderDetailsRequest` em `app/schemas/schemas.py` com os campos opcionais e o `model_validator` para validação condicional de entrega
- [ ] 2.2 Atualizar `SaleOut` em `app/schemas/schemas.py` para incluir os novos campos do pedido
- [ ] 2.3 Atualizar `FinalizeSaleRequest` para permitir `payments` vazia quando `order_type == DELIVERY` e `is_paid == False`

## 3. Backend — Service e Router

- [ ] 3.1 Implementar `SaleService.update_order_details()` em `app/services/sale_service.py`: valida que a venda está OPEN, persiste os dados e retorna `SaleOut`
- [ ] 3.2 Atualizar `SaleService.finalize_sale()` para dispensar validação de pagamento quando `order_type == DELIVERY` e `is_paid == False`
- [ ] 3.3 Adicionar endpoint `PATCH /{sale_id}/order-details` em `app/routers/sales.py` chamando `SaleService.update_order_details()`

## 4. Frontend — Modelo e Service

- [ ] 4.1 Atualizar a interface `Sale` em `src/app/core/models` com os novos campos (`customer_name`, `notes`, `order_type`, `delivery_time`, `delivery_address`, `customer_phone`, `payment_method`, `is_paid`)
- [ ] 4.2 Adicionar enum `OrderTypeEnum` (PICKUP / DELIVERY) nos modelos Angular
- [ ] 4.3 Adicionar método `updateOrderDetails(saleId, payload)` no `SaleService` chamando `PATCH /sales/{id}/order-details`

## 5. Frontend — Componente de Vendas

- [ ] 5.1 Adicionar signals para os campos do painel: `orderType`, `customerName`, `notes`, `deliveryTime`, `deliveryAddress`, `customerPhone`, `deliveryPaymentMethod`, `isPaid`
- [ ] 5.2 Adicionar computed `isDelivery` que retorna `true` quando `orderType() === DELIVERY`
- [ ] 5.3 Adicionar computed `canOpenPayment` que valida campos obrigatórios de entrega quando `isDelivery()` for `true`
- [ ] 5.4 Atualizar o método `openPayment()` para: (a) chamar `updateOrderDetails()` com os dados do painel, (b) se DELIVERY e `isPaid` false, finalizar diretamente sem abrir modal de pagamento
- [ ] 5.5 Adicionar método `finalizeDeliveryReservation()` que chama `finalize` com `payments: []` para pedidos DELIVERY não pagos
- [ ] 5.6 Ao carregar venda existente (`getCurrent()`), preencher os signals com os dados já salvos na venda

## 6. Frontend — Template HTML

- [ ] 6.1 Adicionar painel de detalhes do pedido no `sales.html`, após o `cart-header` e antes dos itens do carrinho
- [ ] 6.2 Implementar seletor visual de tipo de pedido (botões Retirada / Entrega) com binding ao signal `orderType`
- [ ] 6.3 Adicionar campos `customer_name` e `notes` sempre visíveis no painel
- [ ] 6.4 Adicionar bloco condicional `@if (isDelivery())` com campos `delivery_time`, `delivery_address`, `customer_phone`
- [ ] 6.5 Dentro do bloco de entrega, adicionar seletor de `payment_method` e checkbox `is_paid`
- [ ] 6.6 Exibir mensagem de validação quando campos obrigatórios de entrega estiverem ausentes e o operador tentar cobrar

## 7. Frontend — Estilo

- [ ] 7.1 Adicionar estilos para o painel de detalhes do pedido no `sales.scss` (layout, seletor de tipo, campos de entrega)
- [ ] 7.2 Garantir responsividade do painel em telas menores (layout de coluna única)
