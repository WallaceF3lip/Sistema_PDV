## 1. Lógica de Paginação no Componente (data-table.component.ts)

- [x] 1.1 Adicionar o import de `effect` do `@angular/core` (se necessário para o reset de página)
- [x] 1.2 Adicionar o input `paginate: boolean = false` ao `DataTableComponent`
- [x] 1.3 Adicionar o input `pageSize: number = 10` ao `DataTableComponent`
- [x] 1.4 Criar o signal interno `_currentPage = signal<number>(1)`
- [x] 1.5 Criar o computed `totalPages` → `Math.ceil(_rows().length / pageSize)` (retorna `1` quando não há dados)
- [x] 1.6 Criar o computed `currentPageRows` → fatia de `_rows()` com base em `_currentPage` e `pageSize` (retorna `_rows()` inteiro quando `paginate` é `false`)
- [x] 1.7 Criar o computed `visiblePages` → janela deslizante de no máximo 5 páginas centrada na página ativa (`windowStart = clamp(currentPage - 2, 1, max(1, totalPages - 4))`)
- [x] 1.8 Criar o computed `showArrows` → `totalPages() > 5`
- [x] 1.9 Adicionar método `goToPage(page: number): void` para atualizar `_currentPage`
- [x] 1.10 Adicionar método `prevPage(): void` (decrementa se `_currentPage > 1`)
- [x] 1.11 Adicionar método `nextPage(): void` (incrementa se `_currentPage < totalPages`)
- [x] 1.12 Implementar reset de `_currentPage` para `1` no setter `data` ao receber novo array
- [x] 1.13 Implementar reset de `_currentPage` para `1` em `ngOnChanges` ao detectar mudança em `pageSize`

## 2. Template de Paginação (data-table.html)

- [x] 2.1 Atualizar o `@for` do corpo da tabela para iterar sobre `currentPageRows()` em vez de `_rows()` (quando paginação ativa)
- [x] 2.2 Criar o bloco `@if (paginate && totalPages() > 1)` após o `<div class="dt-scroll">` para renderizar o controle de paginação
- [x] 2.3 Dentro do bloco de paginação, adicionar botão `‹` com `[disabled]="currentPage() === 1"` e `(click)="prevPage()"` — visível apenas quando `showArrows()`
- [x] 2.4 Renderizar os números de página com `@for (page of visiblePages(); track page)`, cada um como `<button>` com `[class.active]="page === _currentPage()"` e `(click)="goToPage(page)"`
- [x] 2.5 Adicionar botão `›` com `[disabled]="_currentPage() === totalPages()"` e `(click)="nextPage()"` — visível apenas quando `showArrows()`
- [x] 2.6 Garantir que o controle de paginação não é exibido quando `_rows().length === 0` (estado vazio)

## 3. Estilos de Paginação (data-table.scss)

- [x] 3.1 Adicionar seção `// ─── Paginação ───` no `data-table.scss`
- [x] 3.2 Estilizar o container `.dt-pagination` com `display: flex`, `align-items: center`, `justify-content: center`, `gap: var(--space-2)` e `padding: var(--space-4) var(--space-5)`
- [x] 3.3 Estilizar `.dt-pagination__btn` como botão de tamanho fixo (ex: `32px × 32px`), `border-radius` arredondado, `background: transparent`, `color: var(--color-text)`, `border: 1px solid transparent`, transição suave no hover
- [x] 3.4 Adicionar estado `.dt-pagination__btn--active` com `background: var(--color-primary)`, `color: var(--color-on-primary)`, sem borda
- [x] 3.5 Adicionar estado `[disabled]` no botão de seta com `opacity: 0.35` e `pointer-events: none`
- [x] 3.6 Estilizar os botões de seta com fonte ligeiramente maior para clareza visual

## 4. Verificação e Testes Manuais

- [x] 4.1 Verificar que uma tabela sem o input `paginate` continua exibindo todos os registros sem controle de paginação
- [x] 4.2 Verificar que com `paginate="true"` e menos de `pageSize` itens, a tabela exibe todos sem controle de paginação
- [x] 4.3 Verificar que com 5 páginas ou menos, os números aparecem corretamente sem setas
- [x] 4.4 Verificar que com mais de 5 páginas as setas aparecem e a janela desliza corretamente
- [x] 4.5 Verificar que a seta anterior é desabilitada na página 1 e a próxima na última página
- [x] 4.6 Verificar que o estado vazio (`emptyMessage`) é exibido corretamente quando não há dados com paginação ativa
- [x] 4.7 Verificar que ao trocar o array de dados a página reseta para 1
- [x] 4.8 Executar `ng build` e verificar que não há erros de compilação TypeScript
