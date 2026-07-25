## Context

O `DataTableComponent` é um componente compartilhado Angular (standalone) que renderiza tabelas com suporte a colunas configuráveis, templates de célula customizados, skeleton loading e scroll horizontal. Ele aceita dados via `Signal<T[]>` ou `T[]` e expõe a diretiva `DtCellDirective` para customização de colunas.

Atualmente o componente não possui paginação: todos os registros são renderizados de uma vez. Listas longas (dezenas a centenas de itens) degradam performance do DOM e dificultam a navegação do usuário.

## Goals / Non-Goals

**Goals:**
- Implementar paginação client-side dentro do próprio componente, sem dependências externas.
- Exibir no máximo 5 números de página por vez na barra de paginação.
- Exibir setas de navegação (anterior/próximo) apenas quando o total de páginas for maior que 5.
- Manter retrocompatibilidade total: o comportamento atual é preservado quando `paginate = false` (padrão).
- Seguir os tokens de design e convenções visuais já existentes no projeto (CSS variables, estilos do `data-table.scss`).

**Non-Goals:**
- Paginação server-side (requisições ao backend por página).
- Persistência da página atual entre navegações de rota.
- Configuração do tamanho de página via interface do usuário (combo box).
- Integração com query params de URL.
- Acessibilidade avançada (ARIA live regions, anúncios de mudança de página).

## Decisions

### D1 — Paginação client-side com Computed Signals

**Decisão**: Toda a lógica de paginação vive dentro do `DataTableComponent` usando `signal()` e `computed()` do Angular.

**Rationale**: O componente já usa Signals para `_rows` e `loading`. Manter o padrão evita mistura de abordagens reativas. `computed()` garante que `currentPageRows` seja recalculado automaticamente quando `_currentPage` ou `_rows` mudam, sem necessidade de `ngOnChanges` adicional.

**Alternativas consideradas**:
- Emitir evento e deixar o pai controlar a página: adiciona boilerplate para todos os consumidores e viola o princípio de encapsulamento para um caso de uso tão simples.
- Pipe `paginate` no template: menos testável e menos idiomático com Signals.

---

### D2 — Template embutido, sem sub-componente separado

**Decisão**: O bloco de paginação será renderizado diretamente no template `data-table.html` via `@if (paginate)`, não como um componente filho separado.

**Rationale**: A paginação é funcionalidade interna do `app-data-table`. Criar um `PaginationComponent` separado adicionaria complexidade de comunicação (inputs/outputs) sem benefício real neste contexto — o componente não é reutilizado em outro lugar. Se no futuro houver necessidade de paginação standalone, pode ser extraído.

**Alternativas consideradas**:
- Componente `AppPaginationComponent` separado: mais flexível a longo prazo, mas over-engineering para o escopo atual.

---

### D3 — Janela deslizante de 5 páginas

**Decisão**: Manter um `computed` que calcula quais 5 páginas exibir baseado na página atual. A janela desliza para manter a página ativa sempre visível dentro dela.

**Algoritmo**:
```
windowStart = clamp(currentPage - 2, 1, max(1, totalPages - 4))
windowEnd   = min(windowStart + 4, totalPages)
visiblePages = [windowStart..windowEnd]
```

**Rationale**: A janela centrada na página ativa é o padrão UX mais intuitivo (ex: Google Search). O `clamp` evita janelas menores que 5 quando há páginas suficientes.

---

### D4 — Setas condicionais ao total de páginas > 5

**Decisão**: As setas `‹` e `›` (anterior/próximo) são exibidas somente quando `totalPages > 5`.

**Rationale**: Quando há 5 ou menos páginas, todos os números já são visíveis simultaneamente — as setas seriam redundantes e poluiriam a interface.

---

### D5 — `pageSize` como @Input com padrão 10

**Decisão**: `pageSize` é um `@Input()` com valor padrão `10`. A página é redefinida para 1 sempre que os dados (`_rows`) mudam.

**Rationale**: Valor padrão sensato para a maioria das listas do projeto. Reset automático da página evita o estado inválido de "estar na página 3 quando os dados filtrados só têm 1 página".

## Risks / Trade-offs

- **[Risco] Mudança de dados sem reset de página** → Mitigação: utilizar `effect()` ou lógica no setter de `data` para resetar `_currentPage` para `1` sempre que um novo array for fornecido.
- **[Trade-off] Paginação client-side com datasets grandes**: carregar 10.000 registros do backend para paginar no frontend não é performático. → Mitigação: documentar no JSDoc que para datasets > 500 registros recomenda-se paginação server-side (fora do escopo desta change).
- **[Risco] `pageSize` alterado em runtime**: se o pai mudar `pageSize` depois da renderização, `totalPages` recalcula mas `_currentPage` pode ficar fora do range. → Mitigação: adicionar `ngOnChanges` para resetar a página ao detectar mudança em `pageSize`.
