## 1. Sidebar — Layout e rolagem vertical

- [x] 1.1 Em `pdv_View/src/app/shared/components/sidebar/sidebar.scss`, adicionar `overflow: hidden` a `.sidebar` (mantendo `height: 100vh; height: 100dvh`)
- [x] 1.2 Adicionar `flex-shrink: 0` a `.sidebar__logo` e `.sidebar__footer`
- [x] 1.3 Em `.sidebar__nav`, aplicar `flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain`
- [x] 1.4 Adicionar `@media (max-height: 600px)` compactando padding/margens do logo e do rodapé

## 2. Sidebar — Eixo horizontal e truncamento

- [x] 2.1 Em `.nav-item`, adicionar `min-width: 0`; em `.nav-item__icon`, `flex-shrink: 0`; em `.nav-item__label`, `flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
- [x] 2.2 Em `sidebar.html`, adicionar `[attr.title]="item.label"` nos links de navegação
- [x] 2.3 Aplicar `min-width: 0` em `.user__box` e `.user__info` e ellipsis em `.user__name`/`.user__role`; adicionar `[attr.title]="user.name"` no nome

## 3. Sidebar — Limpeza

- [x] 3.1 Remover a regra raiz `.user { … }` não utilizada de `sidebar.scss`, mantendo `.user__box`, `.user__avatar`, `.user__info`, `.user__name`, `.user__role`
- [x] 3.2 Remover o `<br>` do rodapé em `sidebar.html` e definir `.sidebar__footer { display: flex; flex-direction: column; gap: var(--space-3) }`

## 4. Tela de Vendas — Altura desktop

- [x] 4.1 Em `pdv_View/src/app/pages/sales/sales.scss` (>= 1024px), substituir `height: calc(100dvh - 1%)` por `height: calc(100dvh - var(--space-5))`, eliminando a rolagem vertical do `body`
- [x] 4.2 Confirmar que `.sales-pdv__menu` e `.sales-pdv__cart` continuam rolando internamente

## 5. Build

- [x] 5.1 Rodar `ng build` em `pdv_View` sem erros nem avisos novos de SCSS

## 6. Teste manual

- [ ] 6.1 Desktop 1366x600 (DevTools): logo e rodapé visíveis, nav rola até "Usuários" (ADMIN)
- [ ] 6.2 Desktop 1920x1080: sem barra de rolagem na nav, rodapé ancorado na base
- [ ] 6.3 Adicionar temporariamente 4 itens fictícios em `navItems` (11 no total, sem commitar) em 1366x768: todos alcançáveis, sem rolagem horizontal; remover após o teste
- [ ] 6.4 Usuário com nome longo (ex.: 40 caracteres sem espaço): nome truncado, sem estouro horizontal
- [ ] 6.5 Mobile 390x844 e paisagem 740x360: abrir drawer, rolar a lista até o fim e confirmar que a página ao fundo não rola; fechar pelo overlay e por navegação
- [ ] 6.6 Drawer fechado (< 1024px): nenhuma rolagem horizontal na página
- [ ] 6.7 Tela de Vendas em 1366x768 e 1920x1080: `body` sem rolagem vertical extra; catálogo e carrinho rolando internamente
