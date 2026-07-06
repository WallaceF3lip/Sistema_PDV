## ADDED Requirements

### Requirement: Status PENDING para pedidos reservados
O sistema SHALL usar o status `PENDING` ao fechar vendas de Entrega ou Retirada com `is_paid = false`. O status `PAID` SHALL ser usado apenas quando o pagamento foi efetivamente recebido (Balcão, Entrega paga, Retirada paga).

#### Scenario: Finalizar reserva de Entrega
- **WHEN** `POST /sales/{id}/finalize` é chamado com `payments: []` para uma venda com `order_type: DELIVERY` e `is_paid: false`
- **THEN** a venda é fechada com `status: PENDING`, `closed_at` preenchido e `payments: []`

#### Scenario: Finalizar reserva de Retirada
- **WHEN** `POST /sales/{id}/finalize` é chamado com `payments: []` para uma venda com `order_type: PICKUP` e `is_paid: false`
- **THEN** a venda é fechada com `status: PENDING` e `payments: []`

#### Scenario: Finalizar venda Balcão com pagamento
- **WHEN** `POST /sales/{id}/finalize` é chamado com `payments` preenchido para uma venda de tipo Balcão
- **THEN** a venda é fechada com `status: PAID`

#### Scenario: Finalizar Entrega já paga
- **WHEN** `POST /sales/{id}/finalize` é chamado com `payments` preenchido para uma venda com `order_type: DELIVERY` e `is_paid: true`
- **THEN** a venda é fechada com `status: PAID`

---

### Requirement: Cancelamento de venda PENDING com estorno de estoque
O sistema SHALL permitir cancelar vendas com status `PENDING`, revertendo o estoque baixado na finalização.

#### Scenario: Cancelar venda PENDING
- **WHEN** `POST /sales/{id}/cancel` é chamado para uma venda com `status: PENDING`
- **THEN** o estoque de todos os itens é estornado e a venda é marcada como `CANCELED`

#### Scenario: Cancelar venda PENDING sem itens em estoque suficiente
- **WHEN** `POST /sales/{id}/cancel` é chamado para venda `PENDING` e o estorno falha
- **THEN** o sistema retorna erro 500 e não altera o status da venda

---

### Requirement: Modelo Angular inclui status PENDING
O frontend SHALL reconhecer o valor `PENDING` no `SaleStatusEnum` para exibição correta do estado do pedido.

#### Scenario: Venda retornada com status PENDING
- **WHEN** a API retorna uma venda com `status: "PENDING"`
- **THEN** o frontend não trata o valor como desconhecido ou inválido

---

### Requirement: Balcão salva customer_name e notes antes do pagamento
O sistema SHALL persistir `customer_name`, `notes` e `order_type: null` via `PATCH /sales/{id}/order-details` quando o operador avança do tipo Balcão para a etapa de pagamento no modal de checkout.

#### Scenario: Balcão com nome e observação preenchidos
- **WHEN** o operador seleciona tipo Balcão, preenche `customer_name` e/ou `notes` e clica em Continuar
- **THEN** o frontend chama `PATCH /sales/{id}/order-details` com os dados e só avança para pagamento após sucesso

#### Scenario: Balcão sem nome e sem observação
- **WHEN** o operador seleciona Balcão e clica em Continuar sem preencher nenhum campo
- **THEN** o frontend ainda chama `PATCH /order-details` com `customer_name: null, notes: null, order_type: null` e avança normalmente

#### Scenario: Erro ao salvar order-details no Balcão
- **WHEN** a chamada `PATCH /order-details` falha
- **THEN** o frontend exibe mensagem de erro e NÃO avança para a etapa de pagamento
