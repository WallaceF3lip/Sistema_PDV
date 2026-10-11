# sale-daily-number Specification

## Purpose
Dar a cada pedido finalizado um número curto e sequencial por dia de operação ("Pedido #N"), usado para chamar o cliente, conferir com o entregador e identificar a comanda impressa.

## Requirements

### Requirement: Dia de operação
O sistema SHALL calcular o dia de operação (`business_date`) de um pedido a partir do horário de finalização no fuso `America/Sao_Paulo`, independentemente do fuso do servidor ou do banco. O sistema SHALL suportar uma hora de virada configurável (`BUSINESS_DAY_CUTOFF_HOUR`, 0–23, padrão 0): pedidos finalizados antes dessa hora pertencem ao dia de operação anterior.

#### Scenario: Virada à meia-noite (padrão)
- **WHEN** `BUSINESS_DAY_CUTOFF_HOUR` é 0 e um pedido é finalizado em 12/10 às 00:30 (horário de Brasília)
- **THEN** o pedido recebe `business_date` 2026-10-12

#### Scenario: Virada configurada para madrugada
- **WHEN** `BUSINESS_DAY_CUTOFF_HOUR` é 4 e um pedido é finalizado em 12/10 às 01:15 (horário de Brasília)
- **THEN** o pedido recebe `business_date` 2026-10-11 e entra na sequência de números do dia 11/10

#### Scenario: Servidor em UTC
- **WHEN** o servidor está em UTC e um pedido é finalizado às 22:00 de 11/10 em Brasília (01:00 UTC de 12/10)
- **THEN** o pedido recebe `business_date` 2026-10-11

---

### Requirement: Número sequencial atribuído na finalização
Ao finalizar uma venda (`POST /sales/{id}/finalize`, resultado `PAID` ou `PENDING`), o sistema SHALL atribuir `business_date` e `daily_number`, sendo `daily_number` o próximo inteiro da sequência daquele dia de operação, começando em 1. Vendas `OPEN` (carrinhos) SHALL NOT receber número. Se a finalização falhar (erro de validação, estoque, caixa fechado), o número SHALL NOT ser consumido. O número SHALL ser imutável depois de atribuído, inclusive após quitação ou cancelamento.

#### Scenario: Primeiro pedido do dia
- **WHEN** nenhum pedido foi finalizado no dia de operação e um operador finaliza uma venda
- **THEN** a venda retorna `daily_number: 1` e o `business_date` do dia

#### Scenario: Sequência contínua
- **WHEN** já existem pedidos 1 a 41 no dia e uma reserva de entrega é finalizada como `PENDING`
- **THEN** a reserva recebe `daily_number: 42`

#### Scenario: Finalização com falha não consome número
- **WHEN** o último pedido do dia é o 10 e uma finalização falha com 422 por pagamento divergente
- **THEN** a venda continua `OPEN` sem número e o próximo pedido finalizado com sucesso recebe 11

#### Scenario: Carrinho abandonado
- **WHEN** um operador abre uma venda, adiciona itens e nunca a finaliza
- **THEN** a venda permanece com `daily_number` nulo e não cria lacuna na sequência

#### Scenario: Cancelamento mantém o número
- **WHEN** o Pedido #7 é cancelado
- **THEN** a venda continua com `daily_number: 7` e nenhum outro pedido recebe o número 7 naquele dia

#### Scenario: Novo dia reinicia a sequência
- **WHEN** o primeiro pedido do dia de operação seguinte é finalizado
- **THEN** ele recebe `daily_number: 1`

---

### Requirement: Unicidade sob concorrência
O par (`business_date`, `daily_number`) SHALL ser único, garantido também pelo banco de dados. Finalizações simultâneas por operadores diferentes SHALL receber números distintos e consecutivos, sem lacunas e sem erro para o operador.

#### Scenario: Finalizações simultâneas
- **WHEN** dois operadores finalizam vendas ao mesmo tempo e o último número do dia é 20
- **THEN** uma venda recebe 21 e a outra 22, ambas com sucesso

---

### Requirement: Exposição do número
`SaleOut` SHALL expor `daily_number` (inteiro ou nulo) e `business_date` (data `YYYY-MM-DD` ou nula). As telas SHALL exibir o pedido como "Pedido #<daily_number>" e, quando o número for nulo (vendas anteriores à mudança), como "Venda #<id>".

#### Scenario: Venda antiga sem número
- **WHEN** a tela exibe uma venda finalizada antes desta mudança
- **THEN** o rótulo exibido é "Venda #<id>"

#### Scenario: Pedido numerado
- **WHEN** a tela exibe uma venda com `daily_number: 15`
- **THEN** o rótulo exibido é "Pedido #15"
