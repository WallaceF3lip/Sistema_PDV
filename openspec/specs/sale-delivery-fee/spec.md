# sale-delivery-fee Specification

## Purpose
Registrar a taxa de entrega em cada venda do tipo Entrega, sugerida pela zona do endereço e ajustável pelo operador, compondo o total do pedido que é cobrado, validado na finalização e exibido no checkout.

## Requirements

### Requirement: Composição do total da venda
Cada venda SHALL possuir `delivery_fee` (decimal com 2 casas, padrão 0) e `delivery_zone_id` (opcional). O `total_amount` SHALL ser sempre o total geral, igual à soma dos subtotais dos itens (`items_total`) mais `delivery_fee`. `SaleOut` SHALL expor `items_total`, `delivery_fee`, `delivery_zone_id`, `delivery_zone_name` e `total_amount`. Vendas registradas antes desta mudança SHALL manter `delivery_fee = 0` e o mesmo `total_amount`.

#### Scenario: Venda de entrega com taxa
- **WHEN** uma venda tem itens que somam 50.00 e `delivery_fee` 7.00
- **THEN** `SaleOut` retorna `items_total: 50.00`, `delivery_fee: 7.00` e `total_amount: 57.00`

#### Scenario: Venda antiga
- **WHEN** o usuário consulta uma venda criada antes da mudança
- **THEN** `delivery_fee` é 0, `items_total` é igual a `total_amount` e o total não é alterado

---

### Requirement: Recalcular total ao alterar itens
Enquanto a venda estiver OPEN, adicionar, alterar a quantidade ou remover itens SHALL recalcular `total_amount` como `items_total + delivery_fee`, preservando a taxa já definida.

#### Scenario: Item adicionado após definir a taxa
- **WHEN** uma venda de Entrega com itens 50.00 e taxa 7.00 recebe um novo item de 10.00
- **THEN** `items_total` passa a 60.00, `delivery_fee` permanece 7.00 e `total_amount` passa a 67.00

#### Scenario: Item removido
- **WHEN** um item de 10.00 é removido de uma venda com itens 60.00 e taxa 7.00
- **THEN** `total_amount` passa a 57.00

---

### Requirement: Definir zona e taxa nos detalhes do pedido
O endpoint `PATCH /sales/{id}/order-details` SHALL aceitar `delivery_zone_id` e `delivery_fee` (≥ 0, máx. 9999.99) para vendas OPEN do tipo `DELIVERY`. Quando `delivery_zone_id` for informado sem `delivery_fee`, a taxa SHALL ser a taxa atual da zona. Quando `delivery_fee` for informado, ele SHALL prevalecer sobre a taxa da zona (sobrescrita pelo operador). Uma zona informada SHALL existir (senão 404 "Zona de entrega não encontrada") e, se diferente da zona já gravada na venda, estar ativa (senão 400 "Zona de entrega inativa"). Uma Entrega sem zona SHALL ser permitida, usando a taxa informada manualmente (ou 0). Após a alteração, `total_amount` SHALL ser recalculado.

#### Scenario: Taxa sugerida pela zona
- **WHEN** o operador envia `order_type: "DELIVERY"` com `delivery_zone_id` da zona "Centro" (taxa 5.00) e sem `delivery_fee`
- **THEN** a venda fica com `delivery_zone_id` da zona, `delivery_fee: 5.00` e `total_amount` = itens + 5.00

#### Scenario: Operador sobrescreve a taxa
- **WHEN** o operador envia `delivery_zone_id` da zona "Centro" (taxa 5.00) e `delivery_fee: 3.00`
- **THEN** a venda fica com `delivery_fee: 3.00`, mantendo o vínculo com a zona "Centro"

#### Scenario: Endereço sem zona com taxa manual
- **WHEN** o operador envia `order_type: "DELIVERY"`, `delivery_zone_id: null` e `delivery_fee: 12.00`
- **THEN** a venda fica sem zona, com `delivery_fee: 12.00`

#### Scenario: Zona desativada
- **WHEN** o operador envia `delivery_zone_id` de uma zona inativa que não é a zona atual da venda
- **THEN** o sistema retorna 400 com detalhe "Zona de entrega inativa" e não altera a venda

#### Scenario: Taxa negativa
- **WHEN** o operador envia `delivery_fee: -2`
- **THEN** o sistema retorna 422

#### Scenario: Venda não aberta
- **WHEN** o operador tenta alterar a taxa de uma venda PAID, PENDING ou CANCELED
- **THEN** o sistema retorna 400 e a taxa não é alterada

---

### Requirement: Taxa somente em pedidos de Entrega
Pedidos do tipo Balcão (`order_type` nulo) e Retirada (`PICKUP`) SHALL ter `delivery_fee = 0` e `delivery_zone_id` nulo. Ao salvar os detalhes do pedido com tipo diferente de `DELIVERY`, o sistema SHALL zerar a taxa, remover a zona e recalcular o total, ignorando `delivery_fee`/`delivery_zone_id` enviados. O envio explícito de `order_type: null` SHALL definir a venda como Balcão.

#### Scenario: Retirada não tem taxa
- **WHEN** o operador envia `order_type: "PICKUP"` com `delivery_fee: 5.00`
- **THEN** a venda fica com `delivery_fee: 0`, `delivery_zone_id: null` e `total_amount` igual a `items_total`

#### Scenario: Troca de Entrega para Balcão
- **WHEN** uma venda OPEN com `order_type: "DELIVERY"` e taxa 7.00 recebe `order_type: null`
- **THEN** a venda passa a Balcão (`order_type: null`), `delivery_fee: 0`, `delivery_zone_id: null` e `total_amount` igual a `items_total`

---

### Requirement: Validação do pagamento pelo total geral
Na finalização (`POST /sales/{id}/finalize`) de vendas pagas no ato, a soma dos pagamentos SHALL ser exatamente igual ao `total_amount` (itens + taxa de entrega). Pedidos de Entrega ou Retirada com `is_paid: false` SHALL continuar sendo finalizados como PENDING sem pagamentos, mantendo o total geral (com taxa) como valor a receber.

#### Scenario: Pagamento cobre itens e taxa
- **WHEN** uma Entrega paga no ato tem itens 50.00 e taxa 7.00 e o operador envia pagamentos que somam 57.00
- **THEN** a venda é finalizada como PAID

#### Scenario: Pagamento só dos itens
- **WHEN** o operador envia pagamentos somando 50.00 para a mesma venda
- **THEN** o sistema retorna 422 com detalhe "Pagamento (50.00) difere do total da venda (57.00)"

#### Scenario: Entrega a receber
- **WHEN** uma Entrega com `is_paid: false`, itens 50.00 e taxa 7.00 é finalizada sem pagamentos
- **THEN** a venda fica PENDING com `total_amount: 57.00` e `delivery_fee: 7.00`

---

### Requirement: Taxa preservada no histórico e no cancelamento
Após a finalização, `delivery_fee`, `delivery_zone_id` e `total_amount` da venda SHALL permanecer inalterados, independentemente de mudanças posteriores na zona (taxa, nome ou desativação) ou no endereço do cliente. O cancelamento de uma venda SHALL manter `delivery_fee` e `total_amount` registrados.

#### Scenario: Cancelamento mantém a taxa
- **WHEN** uma venda de Entrega com taxa 7.00 é cancelada
- **THEN** a venda fica CANCELED com `delivery_fee: 7.00` e `total_amount` inalterado

#### Scenario: Zona alterada após a venda
- **WHEN** a taxa da zona é alterada depois de uma venda finalizada com essa zona
- **THEN** a venda mantém a taxa cobrada no momento do pedido

---

### Requirement: Zona e taxa no checkout
Na etapa 2 do modal de checkout, para pedidos do tipo Entrega, o frontend SHALL exibir um seletor de zona (zonas ativas) e um campo de taxa de entrega editável. Ao selecionar um endereço do cliente que possui zona ativa, a zona SHALL ser pré-selecionada e a taxa preenchida com a taxa da zona; ao trocar a zona, a taxa SHALL ser substituída pela taxa da nova zona. Quando o endereço não tiver zona (ou a zona estiver inativa) ou for avulso, o operador SHALL escolher uma zona ou a opção "Sem zona (taxa manual)" informando a taxa; o checkout SHALL NOT avançar sem uma dessas escolhas. Para Balcão e Retirada, o seletor e a taxa SHALL NOT ser exibidos.

#### Scenario: Zona do endereço pré-selecionada
- **WHEN** o operador escolhe Entrega para um cliente cujo endereço padrão está na zona "Centro" (taxa 5.00)
- **THEN** a zona "Centro" aparece selecionada e o campo de taxa mostra 5,00

#### Scenario: Operador altera a taxa sugerida
- **WHEN** o operador altera o campo de taxa de 5,00 para 0,00 (cortesia) e confirma
- **THEN** a venda é salva com `delivery_fee: 0` e a zona "Centro"

#### Scenario: Endereço sem zona
- **WHEN** o endereço selecionado não tem zona e o operador tenta avançar sem escolher zona nem taxa manual
- **THEN** o modal exibe erro de validação no seletor de zona e não avança

#### Scenario: Retirada sem taxa
- **WHEN** o operador escolhe Retirada
- **THEN** o seletor de zona e o campo de taxa não são exibidos e o total do resumo é o total dos itens

---

### Requirement: Exibição dos totais com taxa
O resumo do checkout e a etapa de pagamento SHALL exibir "Itens", "Taxa de entrega" (quando maior que zero) e "Total", usando os valores retornados pela API após salvar os detalhes do pedido. O valor inicial do pagamento e o cálculo de restante/troco SHALL usar o total geral. O resumo do carrinho na tela de vendas SHALL exibir a taxa de entrega quando a venda aberta tiver taxa.

#### Scenario: Pagamento inicial com taxa
- **WHEN** o operador confirma os detalhes de uma Entrega paga no ato com itens 50,00 e taxa 7,00
- **THEN** a etapa de pagamento mostra Itens R$ 50,00, Taxa de entrega R$ 7,00, Total R$ 57,00 e o primeiro pagamento vem preenchido com 57,00

#### Scenario: Troco calculado sobre o total geral
- **WHEN** o total geral é 57,00 e o operador informa 60,00 em dinheiro
- **THEN** o modal exibe troco de R$ 3,00
