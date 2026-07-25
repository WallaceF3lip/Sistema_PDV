## ADDED Requirements

### Requirement: Tela de histórico de vendas acessível via rota
O sistema SHALL disponibilizar uma rota `/sales-history` dentro do layout principal, protegida pelo `authGuard`, que renderiza o componente `SalesHistoryComponent`.

#### Scenario: Acesso autenticado à rota
- **WHEN** um usuário autenticado navega para `/sales-history`
- **THEN** a tela de histórico de vendas é exibida com o layout principal (sidebar + header)

#### Scenario: Acesso não autenticado bloqueado
- **WHEN** um usuário não autenticado tenta acessar `/sales-history`
- **THEN** é redirecionado para a tela de login

---

### Requirement: Item de navegação no sidebar
O sistema SHALL exibir um item de menu "Histórico de Vendas" no sidebar que navega para `/sales-history`.

#### Scenario: Item visível no menu
- **WHEN** o usuário está em qualquer tela do sistema após o login
- **THEN** o sidebar exibe o item "Histórico de Vendas"

#### Scenario: Item ativo na rota correta
- **WHEN** o usuário está na rota `/sales-history`
- **THEN** o item "Histórico de Vendas" no sidebar é destacado como ativo

---

### Requirement: Carregamento inicial com data de hoje
Ao acessar a tela, o sistema SHALL carregar automaticamente as vendas do dia atual, com os campos De e Até preenchidos com a data de hoje.

#### Scenario: Carregamento automático na abertura
- **WHEN** o usuário acessa `/sales-history`
- **THEN** os campos De e Até exibem a data atual e a tabela é preenchida com as vendas do dia

#### Scenario: Estado de carregamento visível
- **WHEN** a requisição ao servidor está em andamento
- **THEN** a tabela exibe o skeleton de loading do `app-data-table`

---

### Requirement: Filtro por intervalo de datas
O sistema SHALL permitir filtrar as vendas por um intervalo de datas informando os campos De (data início) e Até (data fim), disparando nova busca ao servidor ao clicar em "Buscar".

#### Scenario: Busca com intervalo válido
- **WHEN** o usuário define datas De e Até e clica em "Buscar"
- **THEN** o sistema chama `SaleService.list(startDate, endDate)` e exibe as vendas do período

#### Scenario: Busca sem preencher datas
- **WHEN** o usuário clica em "Buscar" sem preencher De ou Até
- **THEN** a busca não é disparada e os campos são destacados como obrigatórios

---

### Requirement: Filtro client-side por nome de produto
O sistema SHALL permitir filtrar as vendas exibidas na tabela pelo nome de um produto, filtrando client-side nas vendas já carregadas.

#### Scenario: Filtro por produto encontrado
- **WHEN** o usuário digita o nome de um produto no campo de filtro de produto
- **THEN** a tabela exibe apenas as vendas que contêm ao menos um item cujo nome de produto inclui o texto digitado (case-insensitive)

#### Scenario: Filtro por produto sem resultado
- **WHEN** o usuário digita um nome que não corresponde a nenhum produto nas vendas carregadas
- **THEN** a tabela exibe a mensagem de estado vazio

#### Scenario: Filtro de produto vazio
- **WHEN** o campo de produto está vazio
- **THEN** nenhum filtro por produto é aplicado e todas as vendas do período são exibidas

---

### Requirement: Filtro client-side por nome do cliente
O sistema SHALL permitir filtrar as vendas exibidas na tabela pelo nome do cliente (campo `customer_name`), filtrando client-side.

#### Scenario: Filtro por cliente encontrado
- **WHEN** o usuário digita o nome de um cliente no campo de filtro de cliente
- **THEN** a tabela exibe apenas as vendas cujo `customer_name` inclui o texto digitado (case-insensitive)

#### Scenario: Filtro de cliente vazio
- **WHEN** o campo de cliente está vazio
- **THEN** nenhum filtro por cliente é aplicado

---

### Requirement: Tabela de vendas com paginação
O sistema SHALL exibir as vendas em uma tabela paginada usando o `app-data-table`, com as colunas: ID, Cliente, Status, Total, Abertura, Fechamento e Ações.

#### Scenario: Tabela preenchida com vendas
- **WHEN** vendas são retornadas pelo servidor
- **THEN** a tabela exibe cada venda em uma linha com os dados: id, customer_name (ou "—" se vazio), status (badge colorido), total_amount formatado como moeda, opened_at e closed_at formatados como data/hora

#### Scenario: Tabela vazia
- **WHEN** nenhuma venda é encontrada no período ou após aplicar filtros
- **THEN** a tabela exibe a mensagem "Nenhuma venda encontrada"

#### Scenario: Paginação visível com muitas vendas
- **WHEN** o número de vendas supera o `pageSize` da tabela
- **THEN** o controle de paginação é exibido abaixo da tabela

---

### Requirement: Badge de status por cor
O sistema SHALL exibir o status de cada venda como um badge com cor diferenciada por tipo.

#### Scenario: Status PAID
- **WHEN** a venda tem status `PAID`
- **THEN** o badge exibe "Pago" com cor de sucesso (verde)

#### Scenario: Status OPEN
- **WHEN** a venda tem status `OPEN`
- **THEN** o badge exibe "Aberta" com cor de destaque (primário ou accent)

#### Scenario: Status PENDING
- **WHEN** a venda tem status `PENDING`
- **THEN** o badge exibe "Pendente" com cor de aviso (warning/muted)

#### Scenario: Status CANCELED
- **WHEN** a venda tem status `CANCELED`
- **THEN** o badge exibe "Cancelada" com cor de erro (danger/muted)

---

### Requirement: Botão de edição por linha (placeholder)
O sistema SHALL exibir um botão "Editar" em cada linha da tabela. Por enquanto o botão não executa nenhuma ação.

#### Scenario: Botão visível em cada linha
- **WHEN** a tabela exibe uma ou mais vendas
- **THEN** cada linha possui um botão "Editar" na coluna de ações

#### Scenario: Clique no botão sem efeito
- **WHEN** o usuário clica no botão "Editar" de uma venda
- **THEN** nenhuma ação é executada (placeholder para futura implementação)
