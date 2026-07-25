## Why

O sistema não possui uma tela dedicada para consulta do histórico de vendas — atualmente não é possível visualizar, filtrar ou gerenciar vendas já realizadas. Essa tela é essencial para que operadores e administradores acompanhem o movimento de vendas, localizem registros específicos e tenham controle operacional do negócio.

## What Changes

- **Nova rota `/sales-history`** no roteador da aplicação.
- **Novo componente `SalesHistoryComponent`** em `pages/sales-history/`, com:
  - Barra de filtros no topo: input de produto, input de nome do cliente e seletor de intervalo de datas (De / Até).
  - Tabela de vendas usando o `app-data-table` com colunas: ID, cliente, status, total, data de abertura e data de fechamento.
  - Botão de edição por linha (sem função por enquanto — placeholder para futura implementação).
  - Paginação habilitada no `app-data-table`.
- **Integração com `SaleService.list()`** existente, passando os parâmetros de data como filtro inicial; filtragem por produto e cliente feita client-side.
- **Novo item de navegação** no sidebar apontando para `/sales-history`.

## Capabilities

### New Capabilities

- `sales-history-view`: Tela de histórico de vendas com tabela paginada, filtros por produto, cliente e intervalo de datas, e botão de edição por linha.

### Modified Capabilities

<!-- Nenhuma capability existente tem seus requisitos alterados -->

## Impact

- **Novo arquivo**: `pdv_View/src/app/pages/sales-history/sales-history.component.ts`
- **Novo arquivo**: `pdv_View/src/app/pages/sales-history/sales-history.html`
- **Novo arquivo**: `pdv_View/src/app/pages/sales-history/sales-history.scss`
- **Arquivo alterado**: `pdv_View/src/app/app.routes.ts` — nova rota `/sales-history`
- **Arquivo alterado**: `pdv_View/src/app/shared/components/sidebar/sidebar.component.ts` (ou `.html`) — novo item de menu
- **Sem breaking changes**: nenhum componente existente é modificado em comportamento
- **Sem novas dependências externas**: usa `SaleService`, `DataTableComponent` e `FormsModule` já presentes
