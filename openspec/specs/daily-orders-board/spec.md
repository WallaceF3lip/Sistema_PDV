# daily-orders-board Specification

## Purpose
Oferecer um quadro operacional com todos os pedidos do dia de operação, agrupados por status e filtráveis por tipo (Balcão, Retirada, Entrega), com atualização automática e ações rápidas de receber, cancelar e reimprimir a comanda — pensado para o pico de fim de semana.

## Requirements

### Requirement: Endpoint do quadro do dia
O sistema SHALL expor `GET /sales/board` para qualquer usuário autenticado, com parâmetro opcional `date` (`YYYY-MM-DD`, padrão: dia de operação atual). A resposta SHALL conter `business_date`, `generated_at`, `orders` (lista de `SaleOut` das vendas finalizadas com aquele `business_date` e status `PENDING`, `PAID` ou `CANCELED`, ordenada por `daily_number` crescente), `status_counts` (para cada status `PENDING`, `PAID`, `CANCELED`: `count` e `total` somando `total_amount`) e `type_counts` (para cada tipo `COUNTER`, `PICKUP`, `DELIVERY`: `count` e `pending_count`). Vendas `OPEN` SHALL NOT aparecer. Contagens com zero SHALL ser incluídas.

#### Scenario: Quadro do dia atual
- **WHEN** um operador chama `GET /sales/board` sem `date` em um sábado com 30 pedidos finalizados e 2 carrinhos abertos
- **THEN** o sistema retorna os 30 pedidos do dia de operação atual, sem os carrinhos, com as contagens por status e tipo

#### Scenario: Quadro de outra data
- **WHEN** um operador chama `GET /sales/board?date=2026-10-10`
- **THEN** o sistema retorna apenas pedidos com `business_date` 2026-10-10

#### Scenario: Dia sem pedidos
- **WHEN** não há pedidos no dia consultado
- **THEN** o sistema retorna `orders: []` e todas as contagens com `count: 0`

#### Scenario: Data inválida
- **WHEN** um operador chama `GET /sales/board?date=11-10-2026`
- **THEN** o sistema retorna 422

---

### Requirement: Dados do pedido para o quadro
`SaleOut` retornado pelo quadro e pelos demais endpoints de venda SHALL incluir, em cada item, `product_name` (nome atual do produto). O pedido SHALL expor também `daily_number`, `paid_at`, `items_total`, `delivery_fee`, `delivery_zone_name`, dados do cliente e de entrega já existentes.

#### Scenario: Itens com nome
- **WHEN** o quadro retorna um pedido com 2 "X-Burguer" e 1 "Refrigerante Lata"
- **THEN** cada item traz `product_name` com o nome do produto além de `product_id`, `quantity`, `unit_price` e `subtotal`

---

### Requirement: Filtros na listagem de vendas
`GET /sales` SHALL aceitar, além de `start_date` e `end_date`, os filtros opcionais `status` (`OPEN`, `PENDING`, `PAID`, `CANCELED`) e `order_type` (`COUNTER` para vendas sem tipo/Balcão, `PICKUP`, `DELIVERY`). Sem filtros, o comportamento atual SHALL ser mantido. Valores inválidos SHALL retornar 422.

#### Scenario: Pendentes de entrega
- **WHEN** um usuário chama `GET /sales?start_date=2026-10-11&end_date=2026-10-11&status=PENDING&order_type=DELIVERY`
- **THEN** o sistema retorna apenas as entregas pendentes do período

#### Scenario: Somente balcão
- **WHEN** um usuário filtra `order_type=COUNTER`
- **THEN** o sistema retorna apenas vendas com `order_type` nulo

---

### Requirement: Página Pedidos do Dia
O sistema SHALL disponibilizar a rota `/orders` ("Pedidos do Dia"), protegida por autenticação, acessível a ADMIN e OPERATOR, e um item "Pedidos do Dia" no sidebar logo após "Vendas". A página SHALL exibir os pedidos agrupados por status em três grupos — "A receber" (`PENDING`), "Pagos" (`PAID`) e "Cancelados" (`CANCELED`) — lado a lado em telas largas e como abas em telas estreitas, com a contagem de cada grupo. O grupo "Cancelados" SHALL iniciar recolhido em telas largas.

#### Scenario: Acesso pelo sidebar
- **WHEN** um OPERATOR clica em "Pedidos do Dia" no sidebar
- **THEN** a página `/orders` é exibida com os pedidos do dia de operação atual

#### Scenario: Tela de celular
- **WHEN** a página é aberta em uma tela com largura menor que 1024px
- **THEN** os grupos são exibidos como abas com contagem e sem rolagem horizontal da página

---

### Requirement: Filtros por tipo e busca
A página SHALL oferecer chips de tipo "Todos", "Balcão", "Retirada" e "Entrega", cada um com a quantidade de pedidos, e um campo de busca por número do pedido, nome do cliente ou telefone. Os filtros SHALL ser aplicados no cliente sobre os pedidos carregados e SHALL ser mantidos durante as atualizações automáticas.

#### Scenario: Filtrar entregas
- **WHEN** o operador seleciona o chip "Entrega"
- **THEN** os três grupos mostram apenas pedidos com `order_type: DELIVERY`

#### Scenario: Buscar pelo número
- **WHEN** o operador digita "42" na busca
- **THEN** são exibidos os pedidos cujo número, nome ou telefone contém "42"

---

### Requirement: Cartão do pedido
Cada pedido SHALL ser exibido como um cartão com: "Pedido #<daily_number>" (ou "Venda #<id>"), badge do tipo (Balcão/Retirada/Entrega), nome do cliente, telefone, horário de entrega/retirada, zona de entrega, total, forma de pagamento prevista (para pendentes) ou formas pagas (para pagos), resumo dos itens (quantidade × nome) e observação. Endereço e taxa de entrega SHALL ser exibidos para Entrega. No grupo "A receber", os cartões SHALL ser ordenados pelo horário de entrega/retirada (pedidos sem horário válido ao final, desempate pelo número); nos grupos "Pagos" e "Cancelados", pelo número decrescente. Um pedido pendente cujo horário já passou (horário de Brasília) SHALL exibir o destaque "Atrasado".

#### Scenario: Ordem dos pendentes
- **WHEN** há pedidos pendentes com horários 20:30, 19:45 e sem horário
- **THEN** o grupo "A receber" exibe 19:45, 20:30 e por último o sem horário

#### Scenario: Pedido atrasado
- **WHEN** são 20:10 e um pedido pendente tem horário 20:00
- **THEN** o cartão exibe o destaque "Atrasado"

#### Scenario: Cartão de entrega
- **WHEN** o cartão é de uma Entrega com zona "Centro" e taxa 6.00
- **THEN** o cartão mostra endereço, "Centro", a taxa e o total incluindo a taxa

---

### Requirement: Atualização automática
A página SHALL recarregar o quadro automaticamente a cada 15 segundos enquanto estiver visível, pausar quando a aba do navegador estiver oculta e recarregar imediatamente ao voltar a ficar visível. A página SHALL oferecer um botão "Atualizar" e exibir o horário da última atualização. Falhas de atualização automática SHALL NOT abrir modais nem limpar os pedidos já exibidos; requisições sobrepostas SHALL ser evitadas. A atualização SHALL NOT fechar um modal de ação aberto. A página SHALL permitir escolher outra data para consulta; em datas diferentes do dia atual a atualização automática SHALL ser desativada.

#### Scenario: Novo pedido aparece sozinho
- **WHEN** um pedido é finalizado no caixa enquanto o quadro está aberto
- **THEN** o pedido aparece no quadro em até ~15 segundos sem ação do operador

#### Scenario: Aba oculta
- **WHEN** o operador muda para outra aba do navegador
- **THEN** nenhuma requisição de quadro é feita até a aba voltar a ficar visível

#### Scenario: Servidor indisponível
- **WHEN** uma atualização automática falha
- **THEN** os pedidos anteriores continuam visíveis e um indicador discreto informa a falha

---

### Requirement: Receber pedido pendente pelo quadro
Cartões `PENDING` SHALL oferecer a ação "Receber", que abre um modal com o número do pedido, o total e a entrada de pagamentos (até 3 formas, com cálculo de restante e troco, pré-preenchida com a forma prevista e o total). Ao confirmar, a página SHALL chamar a quitação, fechar o modal, mostrar mensagem de sucesso e recarregar o quadro. Em caso de erro (ex.: caixa fechado, pedido já quitado), a mensagem do servidor SHALL ser exibida no modal, que permanece aberto; para 400 o quadro SHALL ser recarregado. Com dinheiro acima do total, o troco SHALL ser exibido e o valor enviado em dinheiro SHALL ser o valor devido.

#### Scenario: Receber com troco
- **WHEN** o operador recebe um pedido de 57.00 informando 100.00 em dinheiro
- **THEN** o modal exibe troco de 43.00 e a quitação é enviada com 57.00 em CASH

#### Scenario: Caixa fechado
- **WHEN** o operador confirma o recebimento sem caixa aberto
- **THEN** o modal exibe "Nenhum caixa aberto. Abra o caixa para finalizar vendas." e permanece aberto

---

### Requirement: Cancelar pedido pelo quadro
Cartões `PENDING` e `PAID` SHALL oferecer a ação "Cancelar", que exige confirmação explícita mostrando o número do pedido e o total (e, para pedidos pagos, o aviso de que o valor será estornado do caixa aberto). Após o cancelamento, o quadro SHALL ser recarregado; erros do servidor SHALL ser exibidos ao operador.

#### Scenario: Cancelar pendente
- **WHEN** o operador confirma o cancelamento do Pedido #9 pendente
- **THEN** o pedido passa para o grupo "Cancelados" mantendo o número 9

#### Scenario: Desistir do cancelamento
- **WHEN** o operador fecha a confirmação sem confirmar
- **THEN** nenhuma requisição de cancelamento é enviada

---

### Requirement: Reimprimir comanda pelo quadro
Cartões `PENDING` e `PAID` SHALL oferecer a ação "Reimprimir" somente quando o serviço de impressão de comanda do frontend estiver disponível. A ação SHALL enviar o pedido completo (`SaleOut`, com itens nomeados) ao serviço de impressão. Enquanto a impressão de comanda não estiver implementada, o botão SHALL ficar oculto.

#### Scenario: Impressão disponível
- **WHEN** a impressão de comanda está implementada e o operador clica em "Reimprimir" no Pedido #5
- **THEN** a comanda do Pedido #5 é enviada para impressão

#### Scenario: Impressão ainda não implementada
- **WHEN** a impressão de comanda ainda não está disponível
- **THEN** o botão "Reimprimir" não é exibido nos cartões
