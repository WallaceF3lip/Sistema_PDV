## Context

Motivação em proposal.md (Why). Estado atual verificado no código:

- `pdv_View/src/app/shared/components/sidebar/sidebar.scss`: `.sidebar` é `position: fixed; height: 100dvh; display: flex; flex-direction: column` com padding `--space-5` vertical. `.sidebar__logo` tem `margin-bottom: --space-6`; `.sidebar__nav` tem `flex: 1` **sem** `min-height: 0` nem `overflow-y`; `.sidebar__footer` usa `margin-top: auto`. Resultado: quando o conteúdo excede a altura, a coluna flex estoura para fora da tela (o elemento fixo não rola) e o rodapé/últimos itens ficam inacessíveis.
- Itens `.nav-item` não têm `white-space: nowrap`/`min-width: 0`; rótulos longos quebram em duas linhas. `.user__info` não tem `min-width: 0`, então nomes longos sem espaço estouram horizontalmente a largura fixa `--sidebar-width: 220px` (`src/styles.scss`). Nada na sidebar define `overflow-x`.
- `sidebar.html`: o rodapé usa `<br>` como espaçador. Em `sidebar.scss`, a regra raiz `.user { … padding: --space-5 --space-8; min-height: 72px … }` é resquício do header (não utilizado); apenas `.user__box/__avatar/__info/__name/__role` são usados.
- Mobile (< 1024px): `.sidebar` recebe `transform: translateX(-100%)` e `--open` volta a 0; `.sidebar-overlay` (z-index 99) fecha ao clicar; `sidebar.component.ts` fecha no `NavigationEnd` e no resize >= 1024px. `main-layout.scss` aplica `margin-left: var(--sidebar-width)` só >= 1024px e `.layout__main` já tem `min-width: 0`. `body` já tem `overflow-x: hidden` (`src/styles.scss`).
- `pdv_View/src/app/pages/sales/sales.scss`: `.sales-pdv` no desktop usa `height: calc(100dvh - 1%)` com `margin-top` negativo anulando o padding superior de `.layout__content`, mas o padding inferior (`--space-5`) permanece, então a página de Vendas fica maior que o viewport e o `body` rola alguns pixels (duplo eixo vertical).

## Goals / Non-Goals

**Goals:**
- Sidebar em três faixas (logo / nav rolável / rodapé), somente CSS/template, para desktop e drawer.
- Zero estouro horizontal na sidebar; truncamento com reticências + `title`.
- Remover CSS/markup mortos do rodapé.
- Corrigir a sobra de altura da tela de Vendas no desktop.

**Non-Goals:**
- Redesenho visual, troca de ícones, sidebar recolhível ("mini"), agrupamento de itens por seção.
- Bloqueio de rolagem do `body` via JS quando o drawer abre (usar apenas `overscroll-behavior`).
- Remover o `HeaderComponent` não utilizado (`shared/components/header`) — fica para outra limpeza.
- Gestão de foco do drawer fechado (focus trap / `inert`).
- Adicionar os novos itens de menu (cada change futuro adiciona o seu em `navItems`).

## Decisions

### 1. Rolagem apenas na `<nav>`, com logo e rodapé fixos

**Decisão**: `.sidebar` mantém `display: flex; flex-direction: column; height: 100vh; height: 100dvh` e ganha `overflow: hidden`. `.sidebar__logo` e `.sidebar__footer` recebem `flex-shrink: 0`. `.sidebar__nav` recebe `flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain`. Em `@media (max-height: 600px)`, logo e rodapé ficam mais compactos (menos padding/margem).

**Rationale**: `min-height: 0` é o que permite ao item flex encolher abaixo do conteúdo e ativar o `overflow-y`. Usuário e "Sair" ficam sempre visíveis, comportamento esperado em PDV.

**Alternativa**: `overflow-y: auto` na `.sidebar` inteira. Rejeitada: o rodapé rolaria junto e "Sair"/identidade sumiriam.

### 2. Truncamento em vez de quebra de linha

**Decisão**: `.nav-item` com `min-width: 0`; `.nav-item__label` com `flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`; `.nav-item__icon` com `flex-shrink: 0`. Em `sidebar.html`, `[attr.title]="item.label"` nos links. Mesmo tratamento em `.user__box` e `.user__info` (`min-width: 0`) e `.user__name` (ellipsis + `title`).

**Rationale**: Altura de item previsível (44px) e sem "pulos" visuais; o `title` preserva o texto completo.

**Alternativa**: Aumentar `--sidebar-width`. Rejeitada: afeta o offset de `main-layout` em todas as páginas e não resolve nomes de usuário arbitrários.

### 3. Limpeza do rodapé

**Decisão**: Remover a regra raiz `.user { … }` (mantendo os estilos `.user__*`) e substituir o `<br>` por espaçamento CSS: `.sidebar__footer { display: flex; flex-direction: column; gap: var(--space-3) }`.

**Rationale**: Espaçamento por CSS é previsível e entra no cálculo de altura do rodapé.

**Alternativa**: Manter o `<br>`. Rejeitada: altura depende de `line-height` e não é compactável via media query.

### 4. Altura da tela de Vendas

**Decisão**: Em `sales.scss` (>= 1024px), trocar `height: calc(100dvh - 1%)` por `height: calc(100dvh - var(--space-5))` (descontando o padding inferior de `.layout__content`), mantendo os `margin` negativos atuais.

**Rationale**: O `1%` não corresponde ao padding real; a tela de Vendas deve ocupar exatamente o viewport e rolar apenas internamente (`__menu`/`__cart` já têm `overflow-y: auto`).

**Alternativa**: `margin-bottom` negativo simétrico ao topo. Equivalente; escolhida a forma com `calc` por ser localizada numa única propriedade.

## Risks / Trade-offs

- [Barra de rolagem da nav ocupando largura no Windows] → `overflow-x: hidden` + truncamento absorvem; `scrollbar-width: thin` opcional.
- [`100dvh` sem suporte em navegadores antigos] → manter o fallback `100vh` declarado antes.
- [`overscroll-behavior` sem suporte em Safari < 16] → degradação aceitável (apenas scroll chaining).
- [Ajuste em `sales.scss` alterar o espaçamento inferior do carrinho] → validar visualmente em 1366x768 e 1920x1080 (teste manual).

## Migration Plan

Mudança apenas de CSS/template no frontend; deploy normal do `pdv_View`. Rollback = reverter o commit. Sem dados ou backend envolvidos.
