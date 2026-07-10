## ADDED Requirements

### Requirement: Registrar dados do pedido em uma venda aberta
O sistema SHALL permitir que o operador registre dados do pedido (nome do cliente, observação e tipo de pedido) em uma venda com status OPEN via `PATCH /sales/{sale_id}/order-details`.

#### Scenario: Salvar nome do cliente e observação
- **WHEN** o operador envia `PATCH /sales/{id}/order-details` com `customer_name` e `notes`
- **THEN** o sistema persiste os valores na venda e retorna o objeto `SaleOut` atualizado com status 200

#### Scenario: Campo customer_name ausente
- **WHEN** o operador envia a requisição sem `customer_name`
- **THEN** o sistema aceita e mantém o campo como null (campo opcional)

#### Scenario: Venda não encontrada
- **WHEN** o operador envia `PATCH /sales/9999/order-details`
- **THEN** o sistema retorna 404 com detalhe "Venda não encontrada"

#### Scenario: Venda não está aberta
- **WHEN** o operador envia `PATCH /sales/{id}/order-details` para uma venda com status PAID ou CANCELED
- **THEN** o sistema retorna 400 com detalhe indicando que a venda não está aberta

---

### Requirement: Tipo de pedido — retirada ou entrega
O sistema SHALL suportar dois tipos de pedido no campo `order_type`: `PICKUP` (retirada) e `DELIVERY` (entrega/reserva). O valor padrão SHALL ser `PICKUP`.

#### Scenario: Pedido marcado como retirada
- **WHEN** o operador define `order_type: PICKUP`
- **THEN** o sistema persiste o tipo e retorna `order_type: "PICKUP"` no `SaleOut`

#### Scenario: Pedido marcado como entrega
- **WHEN** o operador define `order_type: DELIVERY`
- **THEN** o sistema persiste o tipo e exige os campos obrigatórios de entrega (delivery_address, customer_phone, delivery_time)

#### Scenario: Campos de entrega ausentes para pedido DELIVERY
- **WHEN** o operador envia `order_type: DELIVERY` sem `delivery_address`, `customer_phone` ou `delivery_time`
- **THEN** o sistema retorna 422 com detalhe indicando os campos obrigatórios ausentes

---

### Requirement: Campos de entrega para pedidos DELIVERY
O sistema SHALL persistir os campos `delivery_time`, `delivery_address` e `customer_phone` quando `order_type` for `DELIVERY`. Esses campos SHALL ser ignorados (ou limpos) quando `order_type` for `PICKUP`.

#### Scenario: Salvar campos de entrega completos
- **WHEN** o operador envia `order_type: DELIVERY` com `delivery_time`, `delivery_address` e `customer_phone`
- **THEN** o sistema persiste todos os campos e os retorna no `SaleOut`

#### Scenario: Alterar tipo de DELIVERY para PICKUP
- **WHEN** o operador envia `order_type: PICKUP` em uma venda que tinha dados de entrega
- **THEN** o sistema limpa os campos de entrega (`delivery_time`, `delivery_address`, `customer_phone`)

---

### Requirement: Forma de pagamento e status de pagamento para entregas
O sistema SHALL permitir registrar `payment_method` e `is_paid` em pedidos do tipo `DELIVERY`. Ambos os campos são opcionais.

#### Scenario: Pedido de entrega já pago
- **WHEN** o operador envia `order_type: DELIVERY`, `payment_method: PIX` e `is_paid: true`
- **THEN** o sistema persiste os valores e os retorna no `SaleOut`

#### Scenario: Pedido de entrega a pagar na entrega
- **WHEN** o operador envia `order_type: DELIVERY` sem `is_paid` ou com `is_paid: false`
- **THEN** o sistema registra `is_paid: false` e aceita `payment_method` como informativo

---

### Requirement: Finalização de pedido DELIVERY sem pagamento imediato
O sistema SHALL permitir finalizar uma venda do tipo `DELIVERY` com `is_paid: false` sem exigir entradas em `payments`. A venda SHALL ser fechada com status `PAID` e sem registros em `payments`.

#### Scenario: Finalizar reserva de entrega sem pagamento
- **WHEN** o operador chama `POST /sales/{id}/finalize` com lista `payments` vazia em uma venda com `order_type: DELIVERY` e `is_paid: false`
- **THEN** o sistema fecha a venda com `status: PAID`, `closed_at` preenchido e `payments: []`

#### Scenario: Finalizar pedido DELIVERY já pago com payments
- **WHEN** o operador chama `POST /sales/{id}/finalize` com `payments` preenchido em uma venda com `order_type: DELIVERY` e `is_paid: true`
- **THEN** o sistema valida pagamento normalmente e fecha a venda

#### Scenario: Finalizar pedido PICKUP sem payments
- **WHEN** o operador chama `POST /sales/{id}/finalize` com `payments` vazia em uma venda do tipo `PICKUP`
- **THEN** o sistema retorna 400 pois pedidos PICKUP exigem pagamento na finalização

---

### Requirement: Exibir painel de detalhes do pedido no carrinho
O frontend SHALL exibir um painel de detalhes do pedido no carrinho com campos para `customer_name`, `notes` e seletor de `order_type` (Retirada / Entrega).

#### Scenario: Painel visível com venda aberta
- **WHEN** existe uma venda OPEN no carrinho
- **THEN** o painel de detalhes é exibido abaixo do cabeçalho do carrinho

#### Scenario: Campos de entrega ocultos para PICKUP
- **WHEN** o tipo selecionado é Retirada (PICKUP)
- **THEN** os campos `delivery_time`, `delivery_address`, `customer_phone`, `payment_method` e `is_paid` NÃO são exibidos

#### Scenario: Campos de entrega visíveis para DELIVERY
- **WHEN** o tipo selecionado é Entrega (DELIVERY)
- **THEN** o painel exibe os campos `delivery_time`, `delivery_address`, `customer_phone`, `payment_method` e checkbox `is_paid`

---

### Requirement: Salvar detalhes do pedido ao confirmar no frontend
O frontend SHALL enviar `PATCH /sales/{id}/order-details` antes de abrir o modal de pagamento quando houver dados preenchidos.

#### Scenario: Dados de entrega válidos antes de cobrar
- **WHEN** o operador clica em "Cobrar" com `order_type: DELIVERY` e todos os campos obrigatórios preenchidos
- **THEN** o frontend envia os dados via PATCH e só então abre o modal de pagamento

#### Scenario: Dados de entrega inválidos ao cobrar
- **WHEN** o operador clica em "Cobrar" com `order_type: DELIVERY` mas sem `delivery_address`, `customer_phone` ou `delivery_time`
- **THEN** o frontend exibe erro de validação e não abre o modal de pagamento

#### Scenario: Modal de pagamento para pedido DELIVERY com is_paid false
- **WHEN** o pedido é DELIVERY e `is_paid` é false
- **THEN** o modal de pagamento é pulado e a venda é finalizada diretamente como reserva (sem payment entries)
