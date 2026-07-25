### Requirement: Paginação habilitável via input
O componente `app-data-table` SHALL aceitar um input booleano `paginate` (padrão `false`). Quando `paginate` for `false`, o comportamento atual de renderizar todos os itens é mantido sem alteração.

#### Scenario: Paginação desabilitada por padrão
- **WHEN** o componente é utilizado sem o input `paginate`
- **THEN** todos os itens são renderizados normalmente, sem nenhum controle de paginação visível

#### Scenario: Paginação habilitada explicitamente
- **WHEN** o input `paginate` é `true`
- **THEN** o componente exibe apenas os itens da página atual e renderiza o controle de paginação abaixo da tabela

---

### Requirement: Tamanho de página configurável
O componente SHALL aceitar um input numérico `pageSize` (padrão `10`) que define quantos itens são exibidos por página quando a paginação está habilitada.

#### Scenario: Uso do pageSize padrão
- **WHEN** `paginate` é `true` e `pageSize` não é fornecido
- **THEN** a tabela exibe no máximo 10 itens por página

#### Scenario: Uso de pageSize customizado
- **WHEN** `paginate` é `true` e `pageSize` é `5`
- **THEN** a tabela exibe no máximo 5 itens por página

---

### Requirement: Números de página exibidos no controle
O controle de paginação SHALL exibir os números das páginas existentes, com no máximo 5 números visíveis por vez.

#### Scenario: Total de páginas menor ou igual a 5
- **WHEN** o total de páginas é ≤ 5
- **THEN** todos os números de página são exibidos no controle

#### Scenario: Total de páginas maior que 5 — início
- **WHEN** o total de páginas é > 5 e a página ativa é 1 ou 2
- **THEN** os números 1, 2, 3, 4 e 5 são exibidos no controle

#### Scenario: Total de páginas maior que 5 — meio
- **WHEN** o total de páginas é > 5 e a página ativa está no meio do conjunto
- **THEN** a janela de 5 páginas é centrada na página ativa

#### Scenario: Total de páginas maior que 5 — fim
- **WHEN** o total de páginas é > 5 e a página ativa é uma das últimas
- **THEN** as últimas 5 páginas são exibidas no controle

---

### Requirement: Destaque visual na página ativa
O controle de paginação SHALL destacar visualmente o número da página que está atualmente selecionada.

#### Scenario: Página ativa destacada
- **WHEN** a página 3 está ativa
- **THEN** o número 3 é exibido com estilo visual diferenciado (ex: fundo preenchido) em relação às demais páginas

---

### Requirement: Navegação por clique no número de página
O usuário SHALL poder navegar para qualquer página clicando no número correspondente no controle.

#### Scenario: Clique em número de página
- **WHEN** o usuário clica no número de uma página disponível no controle
- **THEN** a tabela atualiza para exibir os itens dessa página e o número clicado torna-se a página ativa

---

### Requirement: Setas de navegação condicionais
As setas de navegação anterior (`‹`) e próximo (`›`) SHALL ser exibidas somente quando o total de páginas for maior que 5.

#### Scenario: Sem setas com 5 ou menos páginas
- **WHEN** o total de páginas é ≤ 5
- **THEN** as setas de navegação não são exibidas no controle

#### Scenario: Setas exibidas com mais de 5 páginas
- **WHEN** o total de páginas é > 5
- **THEN** as setas anterior e próximo são exibidas no controle

---

### Requirement: Navegação por setas
Quando visíveis, as setas SHALL permitir avançar e retroceder a janela de páginas exibidas.

#### Scenario: Clique na seta próximo
- **WHEN** o usuário clica na seta `›` e há páginas após a janela atual
- **THEN** a tabela avança para a próxima página e a janela de números desloca para manter a página ativa visível

#### Scenario: Seta próximo desabilitada na última página
- **WHEN** o usuário está na última página
- **THEN** a seta `›` está desabilitada e não é clicável

#### Scenario: Clique na seta anterior
- **WHEN** o usuário clica na seta `‹` e há páginas antes da janela atual
- **THEN** a tabela retrocede para a página anterior e a janela de números desloca para manter a página ativa visível

#### Scenario: Seta anterior desabilitada na primeira página
- **WHEN** o usuário está na primeira página
- **THEN** a seta `‹` está desabilitada e não é clicável

---

### Requirement: Reset de página ao trocar dados
O componente SHALL redefinir a página ativa para 1 sempre que o conjunto de dados (`data`) for atualizado.

#### Scenario: Dados substituídos enquanto em página diferente da primeira
- **WHEN** o usuário está na página 3 e o input `data` recebe um novo array
- **THEN** a página ativa volta para 1

---

### Requirement: Mensagem de vazio com paginação habilitada
Quando `paginate` é `true` e não há dados, o comportamento de mensagem de estado vazio SHALL ser mantido.

#### Scenario: Lista vazia com paginação ativa
- **WHEN** `paginate` é `true` e `data` é um array vazio
- **THEN** a mensagem `emptyMessage` é exibida e o controle de paginação não é exibido
