## Why

Hoje o nome, o telefone e o endereço do cliente são digitados a cada pedido no modal de checkout (`customer_name`, `customer_phone`, `delivery_address` como texto livre em `sales`). Em fins de semana movimentados isso gera retrabalho, erros de digitação e nenhuma visão de clientes recorrentes. Um cadastro de clientes com endereços estruturados (incluindo bairro) é também a base para a futura taxa de entrega por bairro/zona (`delivery-zones-and-fee`).

## What Changes

- Nova tabela `customers` (id, name, phone, notes, is_active, created_at) e `customer_addresses` (id, customer_id, street, number, complement, neighborhood, reference, is_default).
- Novo router `/customers`: listar/buscar (`?q=` por nome ou telefone), consultar, criar, editar e desativar/reativar clientes; sub-recursos `/customers/{id}/addresses` para criar, editar e remover endereços.
- Permissões: qualquer usuário autenticado (ADMIN ou OPERATOR) pode buscar, criar e editar clientes e endereços; apenas ADMIN pode desativar ou reativar um cliente.
- Nova coluna `sales.customer_id` (FK nullable para `customers`), mantendo `customer_name`, `customer_phone` e `delivery_address` como snapshot textual do pedido.
- `PATCH /sales/{id}/order-details` passa a aceitar `customer_id` (validado: cliente existente e ativo; `null` explícito desvincula); `SaleOut` expõe `customer_id`.
- Checkout (etapa 1): campo de nome vira busca com autocomplete de clientes + cadastro rápido (nome/telefone); ao selecionar, preenche nome e telefone. Texto livre sem vínculo continua permitido.
- Checkout (etapa 2, Entrega): seleção entre os endereços cadastrados do cliente (padrão pré-selecionado), com opção de cadastrar novo endereço ou digitar endereço avulso.
- Nova página "Clientes" (`/customers`) com tabela, busca e modal de cadastro/edição com endereços; novo item "Clientes" no sidebar.
- Script SQL `pdv_API/migrations/add_customers.sql` (tabelas + coluna `sales.customer_id` + índices), pois não há Alembic e `create_all` não altera tabelas existentes.

## Capabilities

### New Capabilities
- `customer-management`: Cadastro de clientes e seus endereços estruturados (CRUD, busca por nome/telefone, desativação restrita a ADMIN) via API e página "Clientes".
- `sale-checkout-customer`: Vínculo opcional da venda a um cliente cadastrado (`Sale.customer_id`) com snapshot textual, e seleção/cadastro rápido de cliente e endereço no modal de checkout.

### Modified Capabilities
<!-- Nenhuma: as capacidades de detalhes do pedido/checkout ainda não estão em openspec/specs/. -->

## Impact

- **Backend**: novo `app/models/customer.py`; `app/models/sale.py` (coluna/relacionamento `customer_id`); `app/models/__init__.py`; `app/schemas/schemas.py` (schemas de Customer/Address, `customer_id` em `UpdateOrderDetailsRequest` e `SaleOut`); novos `app/routers/customers.py` e `app/services/customer_service.py`; `app/services/sale_service.py` (`update_order_details`); `app/routers/sales.py`; `main.py` (include_router).
- **Banco de dados**: novo `pdv_API/migrations/add_customers.sql` — deve ser executado antes do deploy do backend.
- **Frontend**: novo `core/models/customer.model.ts` e `core/services/customer.service.ts`; `core/models/sale.model.ts`; nova página `pages/customers`; `app.routes.ts`; `shared/components/sidebar`; `pages/sales/sale-checkout-modal` (autocomplete, cadastro rápido, seleção de endereço).
- **Mudanças futuras**: `delivery-zones-and-fee` adicionará `customer_addresses.delivery_zone_id`; esta change apenas garante o campo `neighborhood` estruturado.
