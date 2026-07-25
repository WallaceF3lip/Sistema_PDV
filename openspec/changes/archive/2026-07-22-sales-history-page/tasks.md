## 1. Estrutura do Componente

- [x] 1.1 Criar o diretório `pdv_View/src/app/pages/sales-history/`
- [x] 1.2 Criar `sales-history.component.ts` com o decorator `@Component` (standalone, imports: CommonModule, FormsModule, DataTableComponent, DtCellDirective)
- [x] 1.3 Criar `sales-history.html` com estrutura inicial (wrapper, header com título e subtítulo)
- [x] 1.4 Criar `sales-history.scss` com estilos base da página

## 2. Lógica do Componente (sales-history.component.ts)

- [x] 2.1 Injetar `SaleService` no construtor
- [x] 2.2 Declarar signals: `sales = signal<Sale[]>([])`, `isLoading = signal<boolean>(false)`
- [x] 2.3 Declarar campos de filtro: `filterProduct = ''`, `filterClient = ''`, `filterDateFrom = ''`, `filterDateTo = ''`
- [x] 2.4 Implementar `ngOnInit`: inicializar `filterDateFrom` e `filterDateTo` com a data de hoje (`toISOString().split('T')[0]`) e chamar `loadSales()`
- [x] 2.5 Implementar `loadSales()`: validar que De e Até estão preenchidos, setar `isLoading(true)`, chamar `SaleService.list(filterDateFrom, filterDateTo)`, popular `sales` com o resultado e setar `isLoading(false)` no complete/error
- [x] 2.6 Criar computed `filteredSales` que aplica client-side os filtros de produto (busca em `sale.items[].product_id` via nome — ou usa um helper) e de cliente (`sale.customer_name`)
- [x] 2.7 Implementar `getStatusLabel(status: SaleStatusEnum): string` retornando o rótulo em PT-BR (PAID→'Pago', OPEN→'Aberta', PENDING→'Pendente', CANCELED→'Cancelada')
- [x] 2.8 Implementar `getStatusClass(status: SaleStatusEnum): string` retornando a classe CSS do badge (ex: `badge--success`, `badge--primary`, `badge--warning`, `badge--danger`)
- [x] 2.9 Implementar `onEdit(sale: Sale): void` como método vazio (placeholder)
- [x] 2.10 Definir `columns: TableColumn[]` com as colunas: id, customer_name, status, total_amount, opened_at, closed_at, actions

## 3. Filtro de Produto por Nome (ajuste de lógica)

- [x] 3.1 Verificar se o modelo `SaleItem` ou `Sale` já carrega o nome do produto; se não, o filtro de produto será feito comparando o `product_id` com uma lista de produtos OU buscar o texto nos dados disponíveis
- [x] 3.2 Implementar a lógica de filtro de produto no `filteredSales` computed: filtrar vendas onde `sale.items` contém ao menos um item cujo dado disponível inclua o texto digitado (case-insensitive) — se o nome não estiver disponível no modelo, filtrar por `product_id` convertido a string

## 4. Template HTML (sales-history.html)

- [x] 4.1 Adicionar card de filtros com três seções: input de produto, input de cliente e inputs De/Até com botão "Buscar"
- [x] 4.2 Conectar os inputs de filtro com `[(ngModel)]` nos campos do componente
- [x] 4.3 Conectar o botão "Buscar" ao método `loadSales()` com `(click)`
- [x] 4.4 Adicionar `<app-data-table>` com `[columns]`, `[data]="filteredSales"`, `[loading]="isLoading"`, `[paginate]="true"`, `[pageSize]="15"` e `emptyMessage="Nenhuma venda encontrada"`
- [x] 4.5 Adicionar `ng-template dtCell="customer_name"` exibindo o nome do cliente ou "—" se vazio
- [x] 4.6 Adicionar `ng-template dtCell="status"` com badge usando `getStatusLabel()` e `getStatusClass()`
- [x] 4.7 Adicionar `ng-template dtCell="total_amount"` exibindo o valor formatado como moeda BRL (`R$ X,XX`)
- [x] 4.8 Adicionar `ng-template dtCell="opened_at"` e `dtCell="closed_at"` com formatação de data/hora (`date:'dd/MM/yyyy HH:mm'`) — exibindo "—" se `closed_at` for null
- [x] 4.9 Adicionar `ng-template dtCell="actions"` com botão `btn btn-ghost` "Editar" chamando `onEdit(row)` (sem efeito)

## 5. Estilos (sales-history.scss)

- [x] 5.1 Estilizar `.sales-history` com `display: flex`, `flex-direction: column`, `gap: var(--space-6)`
- [x] 5.2 Estilizar `.sales-history__header` como flex row com `justify-content: space-between` e `align-items: flex-start`
- [x] 5.3 Estilizar o card de filtros `.sales-history__filters` com layout flex-wrap para os campos, `gap: var(--space-4)` e `padding: var(--space-5)`
- [x] 5.4 Estilizar os grupos de input `.filter-group` com `display: flex`, `flex-direction: column`, `gap: var(--space-2)`
- [x] 5.5 Estilizar o grupo de datas `.filter-date-group` com layout flex row para os dois inputs De/Até e o botão "Buscar"

## 6. Roteamento e Navegação

- [x] 6.1 Importar `SalesHistoryComponent` em `app.routes.ts`
- [x] 6.2 Adicionar rota `{ path: 'sales-history', component: SalesHistoryComponent }` dentro dos children do `MainLayoutComponent` (após a rota `sales`)
- [x] 6.3 Adicionar item de menu "Histórico de Vendas" no sidebar (`sidebar.html` ou `sidebar.component.ts`) com `routerLink="/sales-history"` e ícone apropriado

## 7. Verificação

- [x] 7.1 Executar `ng build` e confirmar ausência de erros de TypeScript
- [x] 7.2 Verificar que a rota `/sales-history` carrega a tela com os filtros e tabela visíveis
- [x] 7.3 Verificar que as datas De/Até são inicializadas com hoje e o carregamento automático ocorre
- [x] 7.4 Verificar que o filtro de cliente funciona (digitar nome filtra a tabela)
- [x] 7.5 Verificar que o botão "Editar" aparece em cada linha sem disparar ação
- [x] 7.6 Verificar que o item "Histórico de Vendas" aparece no sidebar e navega corretamente
