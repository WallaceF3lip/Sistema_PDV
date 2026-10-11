# sidebar-navigation Specification

## Purpose
Define o comportamento de layout e rolagem da navegação lateral do PDV, garantindo que todos os itens de menu, o logo e o rodapé do usuário permaneçam acessíveis em qualquer tamanho de tela, no desktop e no drawer mobile.

## Requirements

### Requirement: Lista de navegação com rolagem vertical independente
A sidebar SHALL manter o logo fixo no topo e o rodapé (identificação do usuário e botão "Sair") fixo na base, e a lista de itens de navegação SHALL rolar verticalmente de forma independente quando não couber no espaço disponível. A rolagem da lista SHALL NOT rolar o conteúdo principal da página.

#### Scenario: Viewport baixo no desktop
- **WHEN** a tela tem largura >= 1024px e altura insuficiente para exibir todos os itens (ex.: 1366x600)
- **THEN** o logo e o rodapé permanecem visíveis e a lista de itens exibe uma barra de rolagem vertical que permite alcançar o último item

#### Scenario: Viewport alto o suficiente
- **WHEN** todos os itens cabem na altura disponível
- **THEN** nenhuma barra de rolagem é exibida na sidebar e o rodapé permanece ancorado na base

#### Scenario: Rolagem da lista não afeta a página
- **WHEN** o usuário rola a lista de navegação até o fim e continua rolando
- **THEN** o conteúdo principal da página não é rolado

### Requirement: Sem estouro horizontal na sidebar
A sidebar SHALL NOT apresentar rolagem horizontal nem conteúdo ultrapassando sua largura. Rótulos de itens e o nome do usuário que excedam a largura disponível SHALL ser truncados em uma linha com reticências, mantendo o texto completo acessível via dica (tooltip).

#### Scenario: Rótulo longo de item
- **WHEN** um item com rótulo longo (ex.: "Histórico de Vendas", "Zonas de Entrega") é exibido
- **THEN** o rótulo ocupa uma única linha, é truncado com reticências se necessário e a sidebar não exibe barra de rolagem horizontal

#### Scenario: Nome de usuário longo
- **WHEN** o usuário logado tem um nome maior que a largura do rodapé
- **THEN** o nome é truncado com reticências e o avatar e o papel continuam visíveis sem estourar a largura da sidebar

### Requirement: Drawer mobile com rolagem
Em telas com largura menor que 1024px, a sidebar SHALL funcionar como drawer (oculto por padrão, aberto pelo botão de menu, fechado ao tocar no fundo ou navegar) e SHALL aplicar as mesmas regras de rolagem vertical e ausência de estouro horizontal. Com o drawer aberto, a rolagem da lista SHALL NOT propagar para a página ao fundo.

#### Scenario: Celular em paisagem
- **WHEN** o drawer está aberto em um viewport de 740x360
- **THEN** o logo e o rodapé ficam visíveis, a lista rola verticalmente e todos os itens podem ser alcançados e tocados

#### Scenario: Drawer fechado não causa rolagem horizontal
- **WHEN** o drawer está fechado em um viewport menor que 1024px
- **THEN** a página não exibe barra de rolagem horizontal decorrente da sidebar

### Requirement: Inclusão de novos itens de menu
A adição de novos itens de navegação (ex.: "Clientes", "Zonas de Entrega", "Pedidos do Dia", "Relatórios") SHALL NOT exigir alterações de layout na sidebar para manter todos os itens acessíveis.

#### Scenario: Menu com 11 itens
- **WHEN** a lista de navegação contém 11 itens visíveis para um ADMIN em um viewport de 1366x768
- **THEN** todos os itens são alcançáveis por rolagem da lista, sem corte do rodapé e sem rolagem horizontal
