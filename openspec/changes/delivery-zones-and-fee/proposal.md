## Why

Hoje o pedido de Entrega registra apenas um endereço em texto livre (`sales.delivery_address`) e não existe cobrança de taxa de entrega: o operador soma a taxa "de cabeça" ou esquece de cobrá-la, e o valor da venda (`total_amount`) não reflete o que o cliente realmente paga. Com o cadastro de clientes e endereços estruturados com bairro (change `customer-registry`, **pré-requisito** desta change), é possível cadastrar zonas de entrega com taxa fixa, associar cada endereço a uma zona e sugerir automaticamente a taxa no checkout, somando-a ao total do pedido.

## What Changes

- **Pré-requisito**: a change `customer-registry` (tabelas `customers`/`customer_addresses`, `Sale.customer_id`, seleção de cliente/endereço no checkout e `add_customers.sql`) deve estar implementada antes desta.
- Nova tabela `delivery_zones` (id, name, fee Numeric(10,2), is_active) e novo router `/delivery-zones`: listagem para qualquer usuário autenticado (apenas ativas por padrão); criação, edição e desativação/reativação restritas a ADMIN. Zonas nunca são excluídas fisicamente.
- Nova coluna `customer_addresses.delivery_zone_id` (FK nullable): o endereço do cliente aponta para uma zona; os endpoints de endereço de `/customers/{id}/addresses` passam a aceitar e retornar a zona.
- Novas colunas em `sales`: `delivery_fee` Numeric(10,2) default 0 e `delivery_zone_id` (FK nullable). O endereço continua como snapshot textual em `delivery_address`.
- **Regra de total**: `total_amount` passa a ser o **total geral** = soma dos itens + `delivery_fee`; `SaleOut` expõe também `items_total`, `delivery_fee`, `delivery_zone_id` e `delivery_zone_name`. O total é recalculado ao adicionar/alterar/remover itens e ao alterar a taxa. Vendas existentes não mudam (taxa 0).
- `PATCH /sales/{id}/order-details` aceita `delivery_zone_id` e `delivery_fee`: a taxa da zona é sugerida quando não informada, o operador pode sobrescrever o valor, e pedidos que não são Entrega (Balcão e Retirada) têm a taxa zerada. `order_type: null` explícito passa a ser respeitado (voltar para Balcão limpa o tipo e a taxa).
- Finalização (`POST /sales/{id}/finalize`) valida o pagamento contra o total geral (itens + taxa); cancelamento mantém a taxa registrada na venda.
- Checkout (etapa 2, Entrega): seletor de zona (pré-selecionado pela zona do endereço do cliente) e campo de taxa editável; endereço sem zona exige escolher uma zona ou informar taxa manual. Resumo e etapa de pagamento exibem Itens, Taxa de entrega e Total.
- Nova página administrativa "Zonas de Entrega" (`/delivery-zones`, somente ADMIN) e item correspondente no sidebar (`adminOnly`).
- Script SQL `pdv_API/migrations/add_delivery_zones.sql`, a ser executado **após** `add_customers.sql` e antes do deploy do backend.

## Capabilities

### New Capabilities
- `delivery-zone-management`: Cadastro de zonas de entrega com taxa (CRUD administrativo, desativação lógica, listagem para o checkout), página "Zonas de Entrega" e associação de endereços de clientes a uma zona.
- `sale-delivery-fee`: Taxa de entrega na venda (sugestão pela zona, sobrescrita pelo operador, zerada fora de Entrega), composição do total (`items_total` + `delivery_fee` = `total_amount`), validação de pagamento pelo total geral e exibição da taxa no checkout.

### Modified Capabilities
<!-- Nenhuma: `customer-management` e `sale-checkout-customer` ainda não foram arquivadas em openspec/specs/ (estão na change `customer-registry`); a associação endereço → zona é descrita como requisito ADDED em `delivery-zone-management`. -->

## Impact

- **Backend**: novo `app/models/delivery_zone.py`; `app/models/customer.py` (de `customer-registry`: `CustomerAddress.delivery_zone_id`); `app/models/sale.py` (`delivery_fee`, `delivery_zone_id`, relação e propriedades `items_total`/`delivery_zone_name`); `app/models/__init__.py`; `app/schemas/schemas.py`; novo `app/routers/delivery_zones.py`; `app/routers/customers.py` e `app/services/customer_service.py` (validação de zona no endereço); `app/services/sale_service.py` (`_recalculate_total`, `update_order_details`); `app/routers/sales.py`; `main.py`.
- **Banco de dados**: novo `pdv_API/migrations/add_delivery_zones.sql` (depende de `add_customers.sql`).
- **API**: `SaleOut` ganha campos (aditivo); `total_amount` passa a incluir a taxa — consumidores que somam receita (dashboard, histórico) passam a contar taxas de entrega como receita.
- **Frontend**: novos `core/models/delivery-zone.model.ts` e `core/services/delivery-zone.service.ts`; `core/models/sale.model.ts` e `customer.model.ts`; nova página `pages/delivery-zones`; `app.routes.ts` (com `adminGuard`); `shared/components/sidebar`; `pages/customers` (zona no formulário de endereço); `pages/sales/sale-checkout-modal` (zona, taxa e totais); `pages/sales` (resumo do carrinho com taxa).
- **Changes futuras**: `order-ticket-printing` e `sales-reports` consomem `items_total`, `delivery_fee` e `delivery_zone_name`.
