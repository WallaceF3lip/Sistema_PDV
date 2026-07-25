## Why

O componente `app-data-table` exibe todos os registros de uma vez, sem limite, o que prejudica a performance e a legibilidade quando há muitos itens. Adicionar paginação resolve esse problema ao dividir os dados em páginas navegáveis, melhorando a usabilidade e o desempenho de listas longas.

## What Changes

- **Novo input `pageSize`** no `DataTableComponent`: define quantos itens são exibidos por página (padrão: 10).
- **Novo input `paginate`**: flag booleana para habilitar/desabilitar a paginação (padrão: `false`, para manter retrocompatibilidade).
- **Lógica de paginação interna**: computed signals para calcular total de páginas, página atual e fatia de dados exibida.
- **Componente de paginação embutido** na parte inferior do `app-data-table`:
  - Exibe os números das páginas disponíveis (máximo 5 por vez).
  - Exibe setas de navegação (anterior/próximo) **somente quando existem mais de 5 páginas**.
  - Destaque visual na página ativa.
  - Ao navegar com as setas, a janela de páginas visíveis desloca para mostrar as demais páginas.
- **Compatibilidade retroativa**: quando `paginate` é `false` (padrão), o comportamento atual é mantido sem nenhuma alteração.

## Capabilities

### New Capabilities

- `data-table-pagination`: Paginação client-side integrada ao `app-data-table`, com navegação por números de página e setas, exibindo no máximo 5 páginas por vez e ocultando as setas quando há 5 ou menos páginas no total.

### Modified Capabilities

<!-- Nenhuma capability existente tem seus requisitos alterados -->

## Impact

- **Arquivo alterado**: `pdv_View/src/app/shared/components/data-table/data-table.component.ts`
- **Arquivo alterado**: `pdv_View/src/app/shared/components/data-table/data-table.html`
- **Arquivo alterado**: `pdv_View/src/app/shared/components/data-table/data-table.scss`
- **Sem breaking changes**: o input `paginate` é `false` por padrão, preservando o comportamento atual de todos os consumidores existentes do componente.
- **Sem novas dependências externas**: paginação implementada com Angular Signals e lógica interna.
