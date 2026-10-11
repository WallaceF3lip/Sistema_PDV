# cash-register-single Specification

## Purpose
Garantir um único caixa compartilhado por todos os operadores do estabelecimento, ao qual cada venda finalizada é vinculada, registrando entradas por forma de pagamento, estornos de cancelamento e o saldo de dinheiro da gaveta até o fechamento.

## Requirements

### Requirement: Caixa único aberto
O sistema SHALL permitir no máximo um caixa com status `OPEN` ao mesmo tempo, independentemente do usuário que o abriu. A unicidade SHALL ser garantida também pelo banco de dados, de modo que duas aberturas simultâneas não resultem em dois caixas abertos. Qualquer usuário autenticado (ADMIN ou OPERATOR) SHALL poder abrir o caixa via `POST /cash-registers/` quando não houver caixa aberto, informando o fundo de troco (`opening_amount` ≥ 0); a abertura SHALL registrar quem abriu e um movimento de abertura com o fundo de troco.

#### Scenario: Abrir caixa sem caixa aberto
- **WHEN** um OPERATOR envia `POST /cash-registers/` com `opening_amount: 100.00` e não existe caixa aberto
- **THEN** o sistema retorna 201 com o caixa `OPEN`, `opened_by_name` igual ao nome do operador, e um movimento `OPENING` de 100.00

#### Scenario: Abrir caixa com outro caixa já aberto
- **WHEN** um usuário tenta abrir um caixa enquanto existe um caixa `OPEN` aberto por outro usuário
- **THEN** o sistema retorna 409 com a mensagem "Já existe um caixa aberto (id=<id>)" e nenhum caixa é criado

#### Scenario: Aberturas concorrentes
- **WHEN** dois usuários enviam a abertura ao mesmo tempo sem caixa aberto
- **THEN** apenas uma abertura é concluída e a outra recebe 409

---

### Requirement: Consulta do caixa atual
O sistema SHALL expor `GET /cash-registers/current` para qualquer usuário autenticado, retornando 200 com o caixa aberto (incluindo movimentos, saldo de dinheiro e `opened_by_name`) ou 200 com corpo `null` quando não houver caixa aberto. `GET /cash-registers/my-open` SHALL continuar disponível por compatibilidade, retornando o mesmo caixa compartilhado, ou 404 quando não houver caixa aberto.

#### Scenario: Operador consulta caixa aberto por outro usuário
- **WHEN** o ADMIN abriu o caixa e um OPERATOR chama `GET /cash-registers/current`
- **THEN** o OPERATOR recebe o caixa aberto pelo ADMIN

#### Scenario: Nenhum caixa aberto
- **WHEN** não existe caixa aberto e um usuário chama `GET /cash-registers/current`
- **THEN** o sistema retorna 200 com `null`

#### Scenario: Endpoint legado
- **WHEN** um cliente antigo chama `GET /cash-registers/my-open` com o caixa aberto por outro usuário
- **THEN** o sistema retorna o caixa compartilhado

---

### Requirement: Finalização exige caixa aberto
`POST /sales/{id}/finalize` SHALL exigir um caixa aberto tanto para vendas pagas (resultado `PAID`) quanto para reservas não pagas (resultado `PENDING`). Sem caixa aberto, o sistema SHALL retornar 409 com a mensagem "Nenhum caixa aberto. Abra o caixa para finalizar vendas." sem baixar estoque, sem registrar pagamentos e mantendo a venda `OPEN`. Ao finalizar, a venda SHALL ser vinculada ao caixa aberto (`cash_register_id`).

#### Scenario: Finalizar sem caixa aberto
- **WHEN** um operador finaliza uma venda de Balcão e não há caixa aberto
- **THEN** o sistema retorna 409, a venda continua `OPEN` e o estoque não é alterado

#### Scenario: Finalizar venda paga
- **WHEN** um operador finaliza uma venda com o caixa 7 aberto
- **THEN** a venda fica `PAID` com `cash_register_id: 7`

#### Scenario: Reserva de entrega não paga
- **WHEN** um operador finaliza uma Entrega com "Já pago?" = não e o caixa 7 está aberto
- **THEN** a venda fica `PENDING` com `cash_register_id: 7` e nenhum movimento de venda é criado

---

### Requirement: Movimento de venda por pagamento
Para cada pagamento registrado em uma venda (na finalização como `PAID` ou na quitação de um pedido `PENDING`), o sistema SHALL criar no caixa aberto um movimento do tipo `SALE` com o valor do pagamento, a forma de pagamento (`payment_method`: CASH, CARD ou PIX) e a referência à venda (`sale_id`), registrando o usuário que finalizou/quitou, e SHALL vincular a venda a esse caixa. A quitação de um pedido `PENDING` SHALL vincular a venda ao caixa aberto no momento da quitação. Movimentos SHALL ser imutáveis após a criação.

#### Scenario: Pagamento misto
- **WHEN** uma venda de 80.00 é finalizada com 50.00 em CASH e 30.00 em PIX
- **THEN** o caixa aberto recebe dois movimentos `SALE`: 50.00 com `payment_method: CASH` e 30.00 com `payment_method: PIX`, ambos com o `sale_id` da venda

#### Scenario: Quitação de pedido pendente em outro caixa
- **WHEN** um pedido `PENDING` finalizado no caixa 7 é quitado enquanto o caixa 8 está aberto
- **THEN** os movimentos `SALE` são criados no caixa 8 e a venda passa a ter `cash_register_id: 8`

---

### Requirement: Saldo de gaveta somente em dinheiro
O saldo corrente do caixa (`current_balance`), a validação de sangria e o valor esperado no fechamento SHALL considerar somente dinheiro: abertura, suprimentos e movimentos `SALE` com `payment_method` CASH somam; sangrias e estornos `SALE_CANCEL` com `payment_method` CASH subtraem. Movimentos de CARD e PIX SHALL ser registrados mas não alteram o saldo da gaveta. O movimento de fechamento não altera o saldo.

#### Scenario: Saldo com vendas em cartão
- **WHEN** um caixa aberto com 100.00 recebe vendas de 40.00 em CASH e 60.00 em CARD
- **THEN** `current_balance` é 140.00

#### Scenario: Sangria limitada ao dinheiro
- **WHEN** o saldo em dinheiro é 140.00 e o ADMIN tenta uma sangria de 150.00
- **THEN** o sistema retorna 422 de saldo insuficiente

---

### Requirement: Estorno no cancelamento de venda paga
Cancelar uma venda `PAID` SHALL exigir um caixa aberto e SHALL criar, no caixa aberto no momento do cancelamento, um movimento `SALE_CANCEL` por pagamento da venda, com o mesmo valor, forma de pagamento e `sale_id`, mesmo que a venda tenha sido vinculada a um caixa já fechado. Sem caixa aberto, o cancelamento de venda `PAID` SHALL ser recusado com 409 e a venda permanece `PAID`. Cancelar venda `OPEN` ou `PENDING` SHALL NOT criar movimentos de caixa nem exigir caixa aberto. Caixas fechados SHALL NOT receber novos movimentos.

#### Scenario: Cancelamento no mesmo caixa
- **WHEN** uma venda `PAID` de 30.00 em CASH é cancelada com o caixa em que foi vendida ainda aberto
- **THEN** o caixa recebe um movimento `SALE_CANCEL` de 30.00 CASH e o saldo da gaveta diminui 30.00

#### Scenario: Cancelamento após o fechamento do caixa de origem
- **WHEN** uma venda `PAID` vinculada ao caixa 7 (fechado) é cancelada com o caixa 8 aberto
- **THEN** o estorno é registrado no caixa 8 e o caixa 7 não é alterado

#### Scenario: Cancelamento sem caixa aberto
- **WHEN** um usuário cancela uma venda `PAID` e não há caixa aberto
- **THEN** o sistema retorna 409 "Nenhum caixa aberto para registrar o estorno" e a venda continua `PAID`

#### Scenario: Cancelamento de pedido pendente
- **WHEN** um pedido `PENDING` é cancelado
- **THEN** o estoque é estornado e nenhum movimento de caixa é criado

---

### Requirement: Fechamento do caixa compartilhado
Somente ADMIN SHALL poder fechar o caixa, registrar sangria e suprimento. O fechamento SHALL registrar a contagem física, o usuário que fechou (`closed_by_name`), o dinheiro esperado e a diferença, e SHALL ser possível mesmo com pedidos `PENDING` vinculados ao caixa (que poderão ser quitados no próximo caixa). Após o fechamento, nenhuma venda SHALL ser vinculada a esse caixa.

#### Scenario: Fechamento com diferença
- **WHEN** o ADMIN fecha o caixa com dinheiro esperado de 140.00 informando contagem de 135.00
- **THEN** o caixa fica `CLOSED` com `expected_balance: 140.00`, `difference: -5.00` e `closed_by_name` do ADMIN

#### Scenario: OPERATOR tenta fechar
- **WHEN** um OPERATOR envia `POST /cash-registers/{id}/close`
- **THEN** o sistema retorna 403

---

### Requirement: Histórico de caixas
O sistema SHALL expor `GET /cash-registers/` restrito a ADMIN, retornando caixas ordenados por abertura (mais recentes primeiro), paginados (`page` ≥ 1, `page_size` entre 1 e 100, padrão 20), com filtros opcionais `start_date`/`end_date` (data de abertura, inclusiva) e `status`. Cada item SHALL conter id, status, abertura, fechamento, quem abriu, quem fechou, fundo de troco, contagem, dinheiro esperado e diferença; a resposta SHALL conter o total de registros.

#### Scenario: Listar histórico do mês
- **WHEN** o ADMIN chama `GET /cash-registers/?start_date=2026-10-01&end_date=2026-10-31&page=1&page_size=20`
- **THEN** recebe os caixas abertos no período, mais recentes primeiro, com `total` de registros

#### Scenario: OPERATOR acessa o histórico
- **WHEN** um OPERATOR chama `GET /cash-registers/`
- **THEN** o sistema retorna 403

---

### Requirement: Página Caixa compartilhada
A página Caixa SHALL exibir o caixa compartilhado aberto para qualquer usuário, indicando quem abriu e quando; sem caixa aberto, SHALL exibir o formulário de abertura para qualquer usuário. Ações de sangria, suprimento e fechamento SHALL aparecer apenas para ADMIN. O formulário de fechamento SHALL exibir o dinheiro esperado e a diferença em relação à contagem digitada antes da confirmação. Movimentos de venda SHALL mostrar a forma de pagamento e estornos SHALL aparecer como "Estorno". Para ADMIN, a página SHALL oferecer a aba "Histórico" com a lista paginada de caixas, filtro por período e acesso ao resumo de cada caixa.

#### Scenario: Operador visualiza caixa aberto pelo ADMIN
- **WHEN** um OPERATOR abre a página Caixa com o caixa aberto pelo ADMIN
- **THEN** vê "Aberto por <nome do ADMIN> às <hora>", o saldo em dinheiro e os movimentos, sem botões de sangria, suprimento ou fechamento

#### Scenario: Página sem caixa aberto
- **WHEN** qualquer usuário abre a página Caixa sem caixa aberto
- **THEN** vê o formulário "Abrir caixa" e nenhuma mensagem de erro é exibida

---

### Requirement: Bloqueio de finalização na tela de vendas
A tela de Vendas SHALL consultar o caixa atual ao carregar e antes de abrir o checkout. Sem caixa aberto, SHALL exibir o aviso "Caixa fechado — abra o caixa para finalizar vendas" com atalho para a página Caixa e SHALL desabilitar a finalização; montar o carrinho continua permitido. Se a finalização falhar por ausência de caixa (409), o checkout SHALL exibir a mensagem do servidor e manter os dados do pedido.

#### Scenario: Tentar finalizar sem caixa
- **WHEN** um operador monta um carrinho sem caixa aberto
- **THEN** o botão de finalizar fica desabilitado e o aviso com o atalho "Ir para o Caixa" é exibido

#### Scenario: Caixa fechado durante o checkout
- **WHEN** o ADMIN fecha o caixa enquanto um operador está no checkout e o operador confirma o pagamento
- **THEN** o checkout exibe "Nenhum caixa aberto. Abra o caixa para finalizar vendas.", não fecha e a venda continua `OPEN`
