## Purpose

Permitir receber o pagamento de pedidos de Retirada/Entrega reservados como `PENDING`, registrando o dinheiro no caixa aberto e marcando o pedido como pago de forma segura mesmo com vários operadores.

## ADDED Requirements

### Requirement: Quitar pedido pendente
O sistema SHALL expor `POST /sales/{id}/settle` para qualquer usuário autenticado, com corpo `{ "payments": [{ "method": "CASH"|"CARD"|"PIX", "amount": <decimal > 0> }] }` (1 a 3 pagamentos). Quando a venda está `PENDING`, o caixa está aberto e a soma dos pagamentos é exatamente igual a `total_amount` (itens + taxa de entrega), o sistema SHALL, em uma única transação: registrar os pagamentos, criar um movimento de caixa `SALE` por pagamento no caixa aberto, vincular a venda a esse caixa (`cash_register_id`), alterar o status para `PAID`, definir `is_paid = true` e `paid_at` com o momento da quitação, e retornar 200 com o `SaleOut` atualizado. `closed_at`, `daily_number`, `business_date`, itens, estoque e `delivery_payment_method` SHALL permanecer inalterados.

#### Scenario: Quitação em dinheiro
- **WHEN** um operador quita o Pedido #12 (`PENDING`, total 57.00) com `[{ "method": "CASH", "amount": 57.00 }]` e o caixa 8 está aberto
- **THEN** o sistema retorna 200 com `status: PAID`, `is_paid: true`, `paid_at` preenchido, `cash_register_id: 8`, um pagamento CASH de 57.00 e o caixa 8 recebe um movimento `SALE` de 57.00 em CASH

#### Scenario: Quitação com pagamento misto
- **WHEN** um pedido `PENDING` de 80.00 é quitado com 50.00 em PIX e 30.00 em CARD
- **THEN** a venda fica `PAID` com dois pagamentos e o caixa aberto recebe dois movimentos `SALE` correspondentes

#### Scenario: Estoque não é baixado novamente
- **WHEN** um pedido `PENDING` é quitado
- **THEN** nenhum movimento de estoque é criado (o estoque já foi baixado na finalização)

---

### Requirement: Validações da quitação
O sistema SHALL rejeitar a quitação sem alterar a venda, o caixa ou os pagamentos quando: a venda não existe (404 "Venda não encontrada"); a venda não está `PENDING` (400 "Apenas pedidos pendentes podem ser quitados (status=<status>)"); a lista de pagamentos está vazia, tem mais de 3 itens ou algum valor ≤ 0 (422); a soma difere de `total_amount` (422 "Pagamento (<soma>) difere do total da venda (<total>)"); não há caixa aberto (409 "Nenhum caixa aberto. Abra o caixa para finalizar vendas.").

#### Scenario: Venda já paga
- **WHEN** um operador tenta quitar uma venda `PAID`
- **THEN** o sistema retorna 400 e nenhum pagamento ou movimento é criado

#### Scenario: Venda cancelada
- **WHEN** um operador tenta quitar uma venda `CANCELED`
- **THEN** o sistema retorna 400

#### Scenario: Valor divergente
- **WHEN** um pedido de 57.00 é quitado com um pagamento de 50.00
- **THEN** o sistema retorna 422 "Pagamento (50.00) difere do total da venda (57.00)" e a venda continua `PENDING`

#### Scenario: Sem caixa aberto
- **WHEN** um operador tenta quitar um pedido `PENDING` e não há caixa aberto
- **THEN** o sistema retorna 409 e a venda continua `PENDING` sem pagamentos

#### Scenario: Pagamentos vazios
- **WHEN** a requisição é enviada com `payments: []`
- **THEN** o sistema retorna 422

---

### Requirement: Concorrência entre quitação e cancelamento
O sistema SHALL serializar operações de quitação e cancelamento sobre a mesma venda, de modo que um pedido nunca seja quitado duas vezes nem quitado e cancelado ao mesmo tempo. A operação que chegar depois SHALL observar o status já atualizado e falhar com a validação correspondente.

#### Scenario: Dois operadores quitam o mesmo pedido
- **WHEN** dois operadores enviam a quitação do mesmo pedido `PENDING` simultaneamente
- **THEN** apenas uma quitação é concluída; a outra recebe 400 e existe um único conjunto de pagamentos e movimentos

#### Scenario: Quitação e cancelamento simultâneos
- **WHEN** um operador quita e outro cancela o mesmo pedido `PENDING` ao mesmo tempo
- **THEN** apenas uma das operações é aplicada e a outra falha com 400, sem pagamentos órfãos nem estoque estornado indevidamente

---

### Requirement: Momento do pagamento
`SaleOut` SHALL expor `paid_at` (data/hora com fuso ou nulo). O sistema SHALL preencher `paid_at` quando a venda é finalizada como `PAID` (mesmo instante de `closed_at`) e quando um pedido `PENDING` é quitado. Vendas `PENDING` SHALL ter `paid_at` nulo. O cancelamento SHALL NOT alterar `paid_at`.

#### Scenario: Finalização paga
- **WHEN** uma venda de Balcão é finalizada como `PAID`
- **THEN** `paid_at` é igual a `closed_at`

#### Scenario: Reserva pendente
- **WHEN** uma Entrega é finalizada como `PENDING`
- **THEN** `paid_at` é nulo e `closed_at` registra o horário da reserva

#### Scenario: Cancelamento de pedido pago
- **WHEN** um pedido pago às 19:10 é cancelado às 19:40
- **THEN** `paid_at` continua 19:10
