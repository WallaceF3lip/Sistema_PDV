# cash-register-channel-summary Specification

## Purpose
Fornecer o resumo financeiro de um caixa, separando o que entrou por forma de pagamento e por canal Balcão vs Delivery (Retirada + Entrega), com taxas de entrega e dinheiro esperado na gaveta, para conferência e fechamento.

## Requirements

### Requirement: Endpoint de resumo do caixa
O sistema SHALL expor `GET /cash-registers/{id}/summary` para qualquer usuário autenticado quando o caixa estiver `OPEN` e somente para ADMIN quando estiver `CLOSED` (403 para OPERATOR). Caixa inexistente SHALL retornar 404. O resumo SHALL ser calculado a partir dos movimentos do caixa e conter: identificação e status do caixa, quem abriu/fechou, fundo de troco, suprimentos, sangrias, total bruto de vendas (soma dos movimentos `SALE`), total de estornos (soma dos `SALE_CANCEL`), total líquido (bruto − estornos), totais líquidos por forma de pagamento (CASH, CARD, PIX, sempre presentes, com 0 quando não houver), dinheiro esperado na gaveta e, se fechado, contagem e diferença.

#### Scenario: Resumo de caixa aberto
- **WHEN** um OPERATOR consulta o resumo do caixa aberto com vendas de 50.00 CASH, 30.00 PIX e 20.00 CARD e fundo de troco 100.00
- **THEN** recebe `gross_total: 100.00`, `net_total: 100.00`, `by_payment_method` com CASH 50.00, CARD 20.00, PIX 30.00 e `expected_cash: 150.00`

#### Scenario: Resumo com estorno
- **WHEN** o caixa tem vendas de 100.00 e um estorno de 30.00 em CASH
- **THEN** `cancellations_total` é 30.00, `net_total` é 70.00 e o total CASH em `by_payment_method` é reduzido em 30.00

#### Scenario: OPERATOR consulta caixa fechado
- **WHEN** um OPERATOR chama o resumo de um caixa `CLOSED`
- **THEN** o sistema retorna 403

---

### Requirement: Separação por canal Balcão vs Delivery
O resumo SHALL conter `by_channel` com exatamente dois canais: `COUNTER` (vendas com `order_type` nulo — Balcão) e `DELIVERY` (vendas com `order_type` PICKUP ou DELIVERY — Retirada e Entrega). Para cada canal SHALL informar: quantidade de vendas pagas, total líquido recebido, total por forma de pagamento e total de taxas de entrega. O canal de cada movimento SHALL ser determinado pelo tipo de pedido da venda referenciada. O resumo SHALL informar também `delivery_fees_total` (soma de `delivery_fee` das vendas pagas contabilizadas no caixa) e `sales_count` (quantidade de vendas com movimento `SALE` no caixa que não foram estornadas nele).

#### Scenario: Movimento misto de Balcão e Delivery
- **WHEN** o caixa recebeu uma venda de Balcão de 40.00 em CASH, uma Retirada de 25.00 em PIX e uma Entrega de 57.00 (itens 50.00 + taxa 7.00) em CARD
- **THEN** `COUNTER` tem 1 venda e 40.00; `DELIVERY` tem 2 vendas, 82.00 e taxas 7.00; `delivery_fees_total` é 7.00 e `sales_count` é 3

#### Scenario: Caixa sem vendas de Delivery
- **WHEN** o caixa só recebeu vendas de Balcão
- **THEN** `by_channel` contém `DELIVERY` com quantidade 0 e valores 0

#### Scenario: Venda cancelada no mesmo caixa
- **WHEN** uma venda de Balcão de 40.00 é paga e estornada no mesmo caixa
- **THEN** ela não entra em `sales_count`, o total líquido de `COUNTER` não inclui os 40.00 e `canceled_count` é 1

---

### Requirement: Pedidos pendentes no resumo
O resumo SHALL informar `pending_count` e `pending_total`: quantidade e soma de `total_amount` das vendas `PENDING` vinculadas ao caixa (reservas ainda não quitadas), sem incluí-las nos totais recebidos.

#### Scenario: Entrega a receber
- **WHEN** o caixa tem uma Entrega `PENDING` de 57.00 vinculada
- **THEN** `pending_count` é 1, `pending_total` é 57.00 e `net_total` não inclui esse valor

---

### Requirement: Exibição do resumo no frontend
A página Caixa SHALL exibir o resumo do caixa aberto com dois blocos, "Balcão" e "Delivery (Retirada + Entrega)", cada um com quantidade de vendas, total e totais por forma de pagamento (Dinheiro, Cartão, PIX), além de taxas de entrega no bloco Delivery; e um bloco geral com total líquido, estornos, pedidos a receber e dinheiro esperado na gaveta. O resumo SHALL ser atualizado ao recarregar a página e após sangria, suprimento ou fechamento. No histórico (ADMIN), selecionar um caixa SHALL exibir o mesmo resumo, incluindo contagem e diferença.

#### Scenario: Conferência antes do fechamento
- **WHEN** o ADMIN abre a página Caixa ao final do dia
- **THEN** vê os totais de Balcão e Delivery separados, o total por forma de pagamento e o dinheiro esperado na gaveta

#### Scenario: Resumo de caixa anterior
- **WHEN** o ADMIN seleciona um caixa fechado na aba "Histórico"
- **THEN** vê o resumo daquele caixa com contagem informada e diferença
