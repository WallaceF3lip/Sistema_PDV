## Why

A navbar lateral (`app-sidebar`) não possui eixo de rolagem próprio: `.sidebar` é `position: fixed` com `height: 100dvh` e `.sidebar__nav` usa `flex: 1` sem `min-height: 0`/`overflow-y`, então em viewports baixos (notebooks 768px de altura, celulares em paisagem, drawer mobile) os itens finais e o rodapé (usuário + "Sair") ficam cortados e inacessíveis. Como os próximos changes vão adicionar "Clientes", "Zonas de Entrega", "Pedidos do Dia" e "Relatórios", o problema vai piorar — precisa ser corrigido antes.

## What Changes

- Sidebar passa a ter layout em três faixas: logo fixo no topo, lista de navegação com rolagem vertical independente, rodapé (usuário + "Sair") fixo na base.
- Eliminar qualquer rolagem/estouro horizontal na sidebar: rótulos longos e nome de usuário longo são truncados com reticências (sem quebrar o layout de 220px).
- Drawer mobile (< 1024px) com o mesmo comportamento de rolagem, sem propagar a rolagem para a página ao fundo (scroll chaining).
- Limpeza de CSS morto em `sidebar.scss` (regra raiz `.user` não utilizada) e do `<br>` usado como espaçamento no rodapé.
- Ajuste pontual em `pages/sales/sales.scss`: a altura desktop `calc(100dvh - 1%)` somada ao padding inferior de `.layout__content` gera rolagem vertical extra do `body` na tela de Vendas.
- Sem mudanças de backend, rotas ou itens de menu.

## Capabilities

### New Capabilities
- `sidebar-navigation`: Comportamento de layout e rolagem da navegação lateral (desktop fixo e drawer mobile), incluindo acessibilidade de todos os itens em qualquer altura de viewport e ausência de estouro horizontal.

### Modified Capabilities

## Impact

- **Frontend**: `pdv_View/src/app/shared/components/sidebar/sidebar.scss` e `sidebar.html` (estrutura/estilos), `pdv_View/src/app/pages/sales/sales.scss` (altura desktop), possivelmente `pdv_View/src/app/layouts/main-layout/main-layout.scss` (verificação de offset/overflow).
- **Backend / APIs / dependências**: nenhum impacto.
- **Changes futuros**: `customer-registry`, `delivery-zones-and-fee`, `daily-orders-board` e `sales-reports` adicionam itens a `navItems` e dependem deste ajuste para não cortar o menu.
