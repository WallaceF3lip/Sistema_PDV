## 1. Backend — Modelo

- [x] 1.1 Adicionar `PENDING = "PENDING"` ao `SaleStatusEnum` em `app/models/sale.py`

## 2. Backend — Migração Alembic

- [x] 2.1 Gerar migração: `alembic revision --autogenerate -m "add PENDING to sale status enum"`
- [x] 2.2 Revisar o arquivo de migração gerado e garantir que contém `ALTER TYPE salestatusenum ADD VALUE 'PENDING'`
- [x] 2.3 Aplicar a migração localmente: `alembic upgrade head`

## 3. Backend — Service

- [x] 3.1 Em `SaleService.finalize_sale`, substituir `sale.status = SaleStatusEnum.PAID` por lógica condicional: usar `SaleStatusEnum.PENDING` quando `is_reservation = True`, `SaleStatusEnum.PAID` nos demais casos
- [x] 3.2 Em `SaleService.cancel_sale`, adicionar `SaleStatusEnum.PENDING` à condição que aciona o estorno de estoque (atualmente só `PAID` aciona o estorno)

## 4. Frontend — Modelo Angular

- [x] 4.1 Adicionar `PENDING = 'PENDING'` ao `SaleStatusEnum` em `pdv_View/src/app/core/models/sale.model.ts`

## 5. Frontend — CheckoutModalComponent

- [x] 5.1 Em `advanceStep()`, para o caso `isCounter()`: antes de inicializar as entradas de pagamento, chamar `saleService.updateOrderDetails()` com `{ customer_name, notes, order_type: null }`
- [x] 5.2 Mover a inicialização das entradas de pagamento (`_initPaymentEntries`) e a navegação para `CheckoutStep.PAYMENT` para dentro do callback `next` da chamada `updateOrderDetails` em `advanceStep()`
- [x] 5.3 No callback `error` de `updateOrderDetails` em `advanceStep()`, exibir toast de erro e não avançar para pagamento
- [x] 5.4 Garantir que `isProcessing` é setado como `true` antes da chamada e `false` no `next`/`error` em `advanceStep()`
