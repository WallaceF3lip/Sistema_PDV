## Context

Motivação em proposal.md. Requisitos em `specs/daily-orders-board`, `specs/sale-settlement` e `specs/sale-daily-number`. **Pré-requisitos implementados**: `customer-registry`, `delivery-zones-and-fee` (`total_amount` = itens + `delivery_fee`; propriedades `Sale.items_total` e `Sale.delivery_zone_name` expostas em `SaleOut`) e `single-cash-register` (`Sale.cash_register_id`; `CashRegisterService.require_open_register(db, lock=True)`, `register_sale_payments(db, sale, payments, user_id)` — `Payment`s já na sessão, sem commit, sobrescreve `cash_register_id`; `register_sale_cancellation`; `sale_channel(order_type)`; cancelamento de `PAID` exige caixa aberto e gera `SALE_CANCEL`; `PENDING` vincula o caixa sem movimentos; script `single_cash_register.sql`).

Estado atual verificado no código:

- `pdv_API/app/models/sale.py`: `Sale` sem número de pedido nem horário de pagamento; `closed_at` é gravado na finalização (PAID ou PENDING) **e sobrescrito** por `cancel_sale`. `SaleItem.product` existe (relação), mas `SaleItemOut` (`app/schemas/schemas.py`) só expõe `product_id`.
- `pdv_API/app/services/sale_service.py`: `finalize_sale` valida, baixa estoque, cria `Payment`s e faz um único `commit`; `cancel_sale` carrega a venda **sem lock** e estorna estoque para PAID/PENDING. Não existe quitação de `PENDING`.
- `pdv_API/app/routers/sales.py`: `GET /{sale_id}` é declarado **antes** de `GET /`; uma rota `GET /board` precisa vir antes de `/{sale_id}` (senão "board" é validado como `int` → 422). `GET /` filtra por `func.date(Sale.opened_at)` (fuso da sessão do banco), sem outros filtros e sem eager loading (N+1 em `items`/`payments`).
- `pdv_API/app/core/config.py`: `Settings` (pydantic-settings, `.env`). Deploy inclui `vercel.json` → `zoneinfo` pode não ter base de fusos no ambiente; Windows (dev) também não tem — necessário pacote `tzdata`.
- Frontend: `pages/sales/sale-checkout-modal` contém o bloco de pagamento (signals `paymentEntries`, `remainingAmount`, `changeAmount`, `canFinalize`, `canAddEntry`, até 3 entradas, métodos PIX/Cartão/Dinheiro). `finalizeSale()` envia os valores digitados: com troco em dinheiro a soma excede o total e o backend responde 422 (bug latente). `pages/sales-history` filtra produto por `product_id` (a spec `sales-history-view` já pede nome) e calcula "hoje" com `toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })`. `core/interceptors/error.interceptor.ts` mostra toast para **todo** erro HTTP — inadequado para polling. Sidebar: `navItems` em `shared/components/sidebar/sidebar.component.ts`. Não há código de impressão.

## Goals / Non-Goals

**Goals:**
- Quitação de `PENDING` atômica, reaproveitando as regras de caixa de `single-cash-register` sem duplicá-las.
- Número de pedido curto, por dia de operação, sem lacunas e seguro com vários operadores.
- Quadro do dia leve o bastante para polling a cada 15 s (uma requisição, sem N+1).
- Um único componente de entrada de pagamentos para checkout e quitação.
- Contrato estável para impressão (`PrintService`) e para relatórios (`business_date`, `paid_at`, filtros).

**Non-Goals:**
- Impressão da comanda (change `order-ticket-printing`; aqui só o contrato/stub).
- WebSocket/SSE, notificações sonoras, status de preparo/saiu-para-entrega (fluxo de cozinha).
- Edição de itens de pedido finalizado, quitação parcial, troco registrado no caixa.
- Paginação do quadro (volume de um dia é pequeno) e cache HTTP/ETag.
- Backfill de `daily_number` para vendas antigas.
- Implementar o botão "Editar" do histórico.

## Decisions

### 1. `paid_at` novo em vez de reutilizar `closed_at`
**Decisão**: coluna `sales.paid_at TIMESTAMPTZ NULL`. `finalize_sale` com resultado `PAID` grava `paid_at = closed_at = now`; `PENDING` deixa nulo; `settle_sale` grava `paid_at = now` e **não** altera `closed_at` (continua sendo o horário em que o pedido foi registrado). `cancel_sale` não toca em `paid_at`. Migração faz backfill `paid_at = closed_at` para vendas `PAID`.
**Rationale**: `closed_at` já significa "fim do carrinho" e é sobrescrito pelo cancelamento; reutilizá-lo perderia o horário do pedido e o do pagamento. Relatórios (`sales-reports`) podem distinguir "vendido em" de "recebido em".
**Alternativa**: sobrescrever `closed_at` na quitação. Rejeitada: o quadro e a comanda perderiam o horário do pedido.

### 2. Número diário atribuído na finalização, via tabela contador
**Decisão**: nova tabela `daily_order_counters (business_date DATE PRIMARY KEY, last_number INTEGER NOT NULL)` (model `DailyOrderCounter` em `app/models/sale.py`). Em `finalize_sale`, após todas as validações e `require_open_register`, imediatamente antes do `commit`:
```sql
INSERT INTO daily_order_counters (business_date, last_number) VALUES (:d, 1)
ON CONFLICT (business_date) DO UPDATE SET last_number = daily_order_counters.last_number + 1
RETURNING last_number;
```
(helper `SaleService._next_daily_number(db, business_date) -> int`, via `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_update(...).returning(...)`). Grava `sale.business_date` e `sale.daily_number`. Colunas `sales.business_date DATE NULL` (index) e `sales.daily_number INTEGER NULL`, com índice único parcial `ux_sales_business_date_daily_number ON sales (business_date, daily_number) WHERE daily_number IS NOT NULL` (também em `__table_args__`).
**Rationale**: (a) atribuir na finalização evita lacunas de carrinhos abandonados (OPEN reaproveitado por usuário; cancelamento de OPEN não consome número) — o número só existe para pedidos que entram no quadro; (b) o `UPSERT` é uma única instrução atômica que trava a linha do dia até o `commit`, então concorrência gera números consecutivos e o `rollback` de uma finalização falha devolve o número (sem lacunas); (c) a trava é curta (feita no fim da transação). O índice único é rede de segurança.
**Alternativa**: `MAX(daily_number)+1` com advisory lock (`pg_advisory_xact_lock`). Rejeitada: mais frágil e exige varrer `sales`. Sequence do PG por dia: rejeitada (não reinicia por dia, gera lacunas em rollback). Atribuir na abertura do carrinho: rejeitada (lacunas e números "queimados").

### 3. Dia de operação com hora de virada configurável
**Decisão**: `Settings.BUSINESS_DAY_CUTOFF_HOUR: int = 0` (0–23) e `Settings.BUSINESS_TIMEZONE: str = "America/Sao_Paulo"`. Novo `app/core/business_day.py`: `business_date_for(moment: datetime | None = None) -> date` (converte para o fuso; se `hour < cutoff`, subtrai um dia) e `current_business_date() -> date`. Dependência `tzdata` em `requirements.txt` para `zoneinfo` funcionar no Windows/Vercel.
**Rationale**: o padrão 0 mantém o dia de operação igual ao dia do calendário (sem surpresa para histórico/relatórios); estabelecimentos que viram a madrugada no fim de semana configuram, por exemplo, `BUSINESS_DAY_CUTOFF_HOUR=4` no `.env` e todo o turno da noite fica no mesmo quadro e na mesma sequência. Calcular no backend evita divergência de fuso entre servidor/banco/navegador.
**Alternativa**: calcular no banco (`AT TIME ZONE`). Rejeitada para o caminho principal (lógica testável em Python); usado só no backfill.

### 4. Quitação (`POST /sales/{id}/settle`)
**Decisão**: schema `SettleSaleRequest { payments: list[PaymentIn] = Field(min_length=1, max_length=3) }`. `SaleService.settle_sale(db, sale_id, payments: list[dict], user_id) -> Sale`:
1. `sale = db.query(Sale).filter(Sale.id == sale_id).with_for_update().first()` → 404.
2. `status != PENDING` → 400 "Apenas pedidos pendentes podem ser quitados (status=<status>)".
3. Soma `Decimal` == `Decimal(total_amount)` senão 422 (mesma mensagem de `finalize_sale`).
4. Dentro de `try`: cria `Payment`s, `db.flush()`, `CashRegisterService.register_sale_payments(db, sale, created, user_id)` (exige caixa → 409; sobrescreve `cash_register_id`; cria `SALE`), `status = PAID`, `is_paid = True`, `paid_at = now(UTC)`, `commit`, `refresh`. `HTTPException` → rollback e repropaga; demais → rollback + 500.
Permissão: `get_current_user` (operador recebe do motoboy). Router: `POST /{sale_id}/settle` → `SaleOut`.
**Rationale**: reaproveita integralmente a regra de caixa; lock da venda impede quitação dupla.

### 5. Ordem de locks e `cancel_sale`
**Decisão**: `cancel_sale` passa a carregar a venda com `with_for_update()` antes de checar o status. Ordem de locks em todas as operações: **venda → caixa** (settle: venda, depois `require_open_register`; cancel de PAID: venda, depois `register_sale_cancellation`). `finalize_sale` trava o caixa e o contador do dia, mas não compete por vendas já finalizadas.
**Rationale**: serializa settle × cancel e cancel × cancel na mesma venda sem risco de deadlock por ordem invertida.

### 6. Quadro: endpoint dedicado + filtros em `GET /sales`
**Decisão**: `GET /sales/board?date=` (declarado antes de `/{sale_id}`), `date: dt.date | None`; padrão `current_business_date()`. `SaleService.get_board(db, business_date) -> dict`: consulta `Sale.business_date == d AND status IN (PENDING, PAID, CANCELED)` ordenada por `daily_number, id`, com `selectinload(Sale.items).selectinload(SaleItem.product)`, `selectinload(Sale.payments)`, `selectinload(Sale.delivery_zone)`. Contagens calculadas em Python sobre a lista. Schemas:
- `OrderTypeFilterEnum` (Python-only): `COUNTER`, `PICKUP`, `DELIVERY` (COUNTER ⇔ `order_type IS NULL`).
- `BoardStatusCount { status: SaleStatusEnum, count: int, total: Decimal }` (sempre PENDING, PAID, CANCELED).
- `BoardTypeCount { order_type: OrderTypeFilterEnum, count: int, pending_count: int }` (sempre os 3).
- `SalesBoardOut { business_date: date, generated_at: datetime, status_counts: list[BoardStatusCount], type_counts: list[BoardTypeCount], orders: list[SaleOut] }`.
`GET /sales` ganha `status: SaleStatusEnum | None` e `order_type: OrderTypeFilterEnum | None` e o mesmo eager loading.
Vendas antigas não têm `business_date` preenchido pela aplicação, mas a migração faz backfill (decisão 10), então aparecem no quadro de datas passadas com rótulo "Venda #id".
**Rationale**: uma requisição por ciclo de polling com tudo que a tela precisa; filtros de `GET /sales` atendem histórico e relatórios sem acoplar ao quadro. Filtros por status/tipo no quadro ficam no cliente (contagens dos chips continuam corretas sem nova requisição).
**Alternativa**: só `GET /sales` com filtros. Rejeitada: filtra por `opened_at` (dia do carrinho, fuso do banco), não pelo dia de operação, e não traz contagens.

### 7. `product_name` no item
**Decisão**: propriedade `SaleItem.product_name -> str | None` (`self.product.name if self.product else None`) e `SaleItemOut.product_name: Optional[str] = None`. Nome é o **atual** do produto (não snapshot).
**Rationale**: sem migração; renomear produto é raro. Snapshot (`sale_items.product_name`) fica para quando houver necessidade fiscal.

### 8. Frontend — modelos, serviço, componente de pagamento e impressão
**Decisão**:
- `core/models/sale.model.ts`: `SaleItem.product_name?: string | null`; `Sale.daily_number?: number | null`, `business_date?: string | null`, `paid_at?: string | null`; `type OrderTypeFilter = 'COUNTER' | 'PICKUP' | 'DELIVERY'`; `SettleSaleRequest { payments: PaymentIn[] }`; `BoardStatusCount { status: SaleStatusEnum; count: number; total: number }`; `BoardTypeCount { order_type: OrderTypeFilter; count: number; pending_count: number }`; `SalesBoard { business_date: string; generated_at: string; status_counts: BoardStatusCount[]; type_counts: BoardTypeCount[]; orders: Sale[] }`; `SaleListFilters { status?: SaleStatusEnum; order_type?: OrderTypeFilter }`; `PaymentEntry` movido do checkout para cá. Helper `saleLabel(sale)` em `core/utils/sale-label.ts` → "Pedido #N" / "Venda #id".
- `core/services/sale.service.ts`: `settle(saleId, req: SettleSaleRequest): Observable<Sale>`, `getBoard(date?: string, opts?: { silent?: boolean }): Observable<SalesBoard>`, `list(startDate, endDate, filters?: SaleListFilters)`.
- Erros silenciosos: `core/interceptors/silent-error.token.ts` com `export const SILENT_ERROR = new HttpContextToken<boolean>(() => false)`; `error.interceptor.ts` não mostra toast quando o token é true (tratamento de 401 mantido). `getBoard(..., { silent: true })` é usado no polling.
- `shared/components/payment-entry/payment-entry.component.ts` (`app-payment-entry`, standalone): `total = input.required<number>()`, `initialMethod = input<PaymentMethodEnum | null>(null)`, `maxEntries = input(3)`; saída `stateChange = output<PaymentEntryState>()` com `PaymentEntryState { payments: PaymentIn[]; valid: boolean; remaining: number; change: number }`. Mantém a UI/estilos atuais (tender buttons, restante, troco). **Normalização**: em `payments`, o troco é descontado da(s) entrada(s) CASH (soma == total, arredondado a 2 casas); entradas ≤ 0 removidas. Checkout e modal de quitação usam o componente.
- Contrato de impressão `core/services/print.service.ts`: `@Injectable({ providedIn: 'root' }) class PrintService { canPrint(): boolean; printOrderTicket(sale: Sale): void }`. Esta change cria o **stub** (`canPrint() → false`, `printOrderTicket` no-op com `console.warn`). A change `order-ticket-printing` substitui a implementação mantendo a assinatura (e passa `canPrint()` a `true`). Se `order-ticket-printing` for implementada antes, esta change apenas consome o serviço existente.
**Rationale**: um único ponto para regras de pagamento corrige o bug do troco nos dois fluxos; o stub permite entregar o quadro sem bloquear na impressão.

### 9. Página `/orders` "Pedidos do Dia"
**Decisão**: `pages/orders/orders.component.ts|html|scss` (standalone, signals). Estado: `board = signal<SalesBoard | null>`, `selectedDate = signal<string | null>(null)` (null = dia atual do servidor; o seletor mostra `board().business_date`), `typeFilter = signal<OrderTypeFilter | 'ALL'>('ALL')`, `search = signal('')`, `mobileTab = signal<'PENDING'|'PAID'|'CANCELED'>('PENDING')`, `showCanceled = signal(false)`, `lastUpdated`, `refreshError`, `settleTarget = signal<Sale | null>`, `cancelTarget = signal<Sale | null>`. `computed` para grupos filtrados/ordenados e contagens dos chips (sobre `orders`). Ordenação de pendentes por `delivery_time` válido `/^\d{1,2}:\d{2}$/` → minutos; inválido/nulo ao final; desempate `daily_number`. "Atrasado": pendente com horário < agora em `America/Sao_Paulo` (somente quando a data é o dia atual).
Polling: `merge(timer(0, 15000), fromEvent(document,'visibilitychange'))` filtrado por `document.visibilityState === 'visible'` e `selectedDate() === null`, `exhaustMap` para `getBoard(undefined, { silent: true })`, `takeUntilDestroyed`. Erro: mantém dados e mostra "Falha ao atualizar às HH:mm". Botão "Atualizar" faz carga não silenciosa.
Modais: `glass-overlay`/`modal-card`. Quitação: total, `app-payment-entry` com `initialMethod = sale.delivery_payment_method`, erro inline com `error.error.detail` (requisição de settle com `SILENT_ERROR` para não duplicar o toast); em 400 recarrega o quadro. Cancelamento: confirmação com número/total e aviso de estorno para PAID; usa `saleService.cancel`. Os modais guardam a venda selecionada (snapshot), então o polling não os fecha.
Layout: grid de 3 colunas ≥1024px (Cancelados recolhido por padrão, botão para expandir), abas abaixo disso; chips com `.badge`; cartões com tokens de `styles.scss`; `app.routes.ts` rota `orders`; sidebar `{ icon: '▣', label: 'Pedidos do Dia', route: '/orders' }` após "Vendas".

### 10. Migração SQL `pdv_API/migrations/daily_orders_board.sql`
**Decisão** (executar após `single_cash_register.sql`, antes do deploy do backend; uma transação):
- Guarda: `RAISE EXCEPTION` se `sales.cash_register_id` não existir ("Execute single_cash_register.sql antes").
- `ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL, ADD COLUMN IF NOT EXISTS business_date DATE NULL, ADD COLUMN IF NOT EXISTS daily_number INTEGER NULL;`
- `CREATE INDEX IF NOT EXISTS ix_sales_business_date ON sales (business_date);` e `CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_business_date_daily_number ON sales (business_date, daily_number) WHERE daily_number IS NOT NULL;`
- `CREATE TABLE IF NOT EXISTS daily_order_counters (business_date DATE PRIMARY KEY, last_number INTEGER NOT NULL CHECK (last_number >= 0));`
- Backfill: `UPDATE sales SET paid_at = closed_at WHERE status = 'PAID' AND paid_at IS NULL;` e `UPDATE sales SET business_date = (closed_at AT TIME ZONE 'America/Sao_Paulo')::date WHERE status <> 'OPEN' AND closed_at IS NOT NULL AND business_date IS NULL;` (virada à meia-noite; `daily_number` fica nulo).

## Risks / Trade-offs

- [Risco] Backend publicado antes do SQL → colunas inexistentes quebram toda query de `Sale`. → Mitigação: script obrigatório, idempotente, ordem no cabeçalho e na tarefa 1.
- [Risco] Linha do contador vira ponto de serialização de finalizações. → Aceito: a trava dura só do `UPSERT` ao `commit` (fim da transação); volume de um PDV é baixo.
- [Trade-off] Vendas legadas canceladas a partir de `OPEN` também recebem `business_date` no backfill; o quadro de datas passadas mostra-as em "Cancelados" como "Venda #id". → Aceito (somente histórico).
- [Trade-off] Mudar `BUSINESS_DAY_CUTOFF_HOUR` no meio do dia pode iniciar nova sequência ou juntar dias. → Documentar: alterar apenas com a loja fechada.
- [Risco] Polling de vários terminais a cada 15 s. → Uma consulta indexada por `business_date` com `selectinload`; pausa com aba oculta; `exhaustMap` evita sobreposição.
- [Trade-off] `product_name` é o nome atual do produto, não snapshot. → Aceito.
- [Risco] Normalização do troco altera o payload do checkout (antes enviava o valor digitado). → É correção: antes o backend rejeitava (422); testar pagamento misto e troco.
- [Risco] Toast do interceptor em cada falha de polling. → `SILENT_ERROR`.

## Migration Plan

1. Confirmar `add_customers.sql`, `add_delivery_zones.sql` e `single_cash_register.sql` executados.
2. Executar `pdv_API/migrations/daily_orders_board.sql` (decisão 10).
3. (Opcional) definir `BUSINESS_DAY_CUTOFF_HOUR` no `.env` do backend; instalar dependências (`tzdata`).
4. Deploy do backend, depois do frontend.
5. Verificar: finalizar duas vendas → números 1 e 2 (ou seguintes); `GET /sales/board`; quitar um `PENDING`.

**Rollback**: código anterior ignora as colunas novas (nullable) e a tabela de contador. Remoção completa: `DROP INDEX IF EXISTS ux_sales_business_date_daily_number; DROP INDEX IF EXISTS ix_sales_business_date; ALTER TABLE sales DROP COLUMN IF EXISTS daily_number, DROP COLUMN IF EXISTS business_date, DROP COLUMN IF EXISTS paid_at; DROP TABLE IF EXISTS daily_order_counters;`. Vendas quitadas permanecem `PAID` com pagamentos e movimentos válidos.
