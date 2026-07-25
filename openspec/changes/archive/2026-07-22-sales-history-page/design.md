## Context

O projeto já possui um `SalesComponent` dedicado ao PDV (ponto de venda ativo), que exibe o carrinho da venda atual e o checkout. Não existe, porém, uma tela para consultar o histórico de vendas passadas.

O `SaleService` já disponibiliza o método `list(startDate, endDate)` que retorna `Sale[]` via `GET /sales?start_date=&end_date=`. O modelo `Sale` já contém os campos necessários: id, status, total_amount, customer_name, opened_at, closed_at e items.

O projeto usa Angular standalone components, Signals para estado reativo, `app-data-table` para tabelas e `FormsModule` para bindings de inputs. O padrão de layout de página segue: header com título + subtítulo, card de filtros, tabela.

## Goals / Non-Goals

**Goals:**
- Criar a rota `/sales-history` com um componente Angular standalone dedicado.
- Exibir a lista de vendas com filtros client-side por produto (nome nos itens) e por nome do cliente.
- Filtrar por intervalo de datas (De/Até) via chamada ao `SaleService.list()`.
- Tabela com paginação usando o `app-data-table` já existente (com o input `paginate`).
- Botão de edição por linha da tabela (sem ação — placeholder).
- Item de navegação no sidebar.

**Non-Goals:**
- Implementação da funcionalidade de edição de venda (botão fica sem ação).
- Filtro server-side por produto ou cliente (feito client-side).
- Exportação de relatórios.
- Detalhes expandidos da venda inline (pode ser feito em change futura).

## Decisions

### D1 — Rota separada `/sales-history`, não sub-rota de `/sales`

**Decisão**: A tela de histórico é uma rota de primeiro nível (`/sales-history`) dentro do `MainLayoutComponent`, separada do PDV (`/sales`).

**Rationale**: O PDV é uma tela operacional em tempo real; o histórico é uma tela consultiva. São contextos diferentes que merecem entradas distintas no menu. Agrupar como sub-rota adicionaria complexidade de roteamento sem benefício.

---

### D2 — Filtragem de produto e cliente client-side, datas server-side

**Decisão**: O intervalo de datas é enviado como parâmetro para `SaleService.list(startDate, endDate)`. A filtragem por nome de produto e nome de cliente é feita com `computed()` sobre o array retornado.

**Rationale**: A API já aceita filtro por data. Filtro server-side de produto/cliente exigiria mudanças no backend fora do escopo desta change. O volume de vendas por período é gerenciável para filtragem client-side.

**Alternativas consideradas**: Adicionar parâmetros de filtro à API — descartado por ampliar o escopo e requerer mudança no backend.

---

### D3 — Data padrão: hoje

**Decisão**: Ao carregar a tela, os campos De/Até são inicializados com a data de hoje, e `loadSales()` é chamado automaticamente no `ngOnInit`.

**Rationale**: O caso de uso mais comum é consultar as vendas do dia. Evita tela vazia no primeiro acesso.

---

### D4 — Botão de edição sem ação (placeholder)

**Decisão**: O botão "Editar" por linha é renderizado mas seu `(click)` não está ligado a nenhuma função — ou chama uma função `onEdit(sale)` que retorna sem fazer nada.

**Rationale**: O usuário pediu explicitamente que o botão fique sem função por enquanto. Manter o método vazio é mais limpo do que omitir o handler.

---

### D5 — Status exibido como badge colorido

**Decisão**: A coluna de status usa um `ng-template` dtCell com classes de badge dinâmicas baseadas no valor do enum `SaleStatusEnum`.

**Rationale**: Segue o padrão já adotado em `users.html` para a coluna `role`, e melhora a escaneabilidade visual.

## Risks / Trade-offs

- **[Risco] Volume alto de vendas em períodos longos** → Mitigação: a paginação client-side no `app-data-table` já limita os itens renderizados. Para períodos muito grandes, considerar paginação server-side em change futura.
- **[Trade-off] Filtro client-side de produto**: pesquisa nos nomes dos itens da venda pode ser lento com muitos registros. → Aceitável para o volume esperado; documentado como limitação.
- **[Risco] API retorna erro se datas estiverem em formato incorreto** → Mitigação: formatar as datas como `YYYY-MM-DD` usando o método `toISOString().split('T')[0]` antes de enviar.
