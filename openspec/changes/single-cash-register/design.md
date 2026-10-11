## Context

Motivação em proposal.md (Why). Requisitos em `specs/cash-register-single/spec.md` e `specs/cash-register-channel-summary/spec.md`. **Pré-requisitos**: `customer-registry` e `delivery-zones-and-fee` implementadas (`Sale.delivery_fee`, `Sale.items_total`, `total_amount` = itens + taxa, `add_delivery_zones.sql` executado).

Estado atual verificado no código:

- `pdv_API/app/models/cash_register.py`: `CashRegister` (`user_id` = quem abriu, `status` OPEN/CLOSED, `opening_amount`, `closing_amount`, `opened_at`, `closed_at`, `notes`, `movements` com cascade) e `CashMovement` (`type` OPENING/SALE/SANGRIA/SUPRIMENTO/CLOSING, `amount` sempre positivo, `description`, `user_id`, `created_at`). Enums nativos do PG: `cashregisterstatusenum`, `cashmovementtypeenum`. `SALE` existe mas nunca é criado.
- `pdv_API/app/services/cash_register_service.py`: `open_register` só impede outro OPEN **do mesmo usuário**; `get_balance` soma OPENING/SALE/SUPRIMENTO e subtrai SANGRIA; `create_sangria` valida saldo; `close_register` cria movimento CLOSING (não afeta saldo) e não grava quem fechou; `get_my_open_register` filtra por `user_id` (404 se não houver).
- `pdv_API/app/routers/cash_registers.py`: `POST /` (qualquer usuário), `GET /my-open`, `GET /{id}`, `GET /{id}/movements`, sangria/suprimento/close com `require_admin`. Não há listagem.
- `pdv_API/app/schemas/schemas.py`: `CashRegisterOut.compute_balance` (model_validator) **duplica** a regra de saldo do serviço; `CashMovementOut` sem forma de pagamento.
- `pdv_API/app/services/sale_service.py`: `finalize_sale` (reserva PICKUP/DELIVERY com `is_paid is False` → PENDING sem pagamentos; senão soma dos pagamentos == `total_amount` → PAID; baixa estoque, cria `Payment`, um único `db.commit()`); `cancel_sale` estorna estoque para PAID/PENDING, sem tocar em pagamentos. `Payment.method` usa o enum PG `paymentmethodenum`.
- Frontend: `pages/cash-register/cash-register.component.ts` chama `getMyOpen()` (o 404 sem caixa dispara toast de erro do `error.interceptor.ts` a cada carregamento); `isInflow`/`movementTypeLabel` hardcoded; ações admin via `authService.isAdmin()`. `pages/sales/sales.html` habilita "Continuar" apenas por itens no carrinho. `sale-checkout-modal.component.ts` `finalizeSale()`/`_finalizeReservation()` só tratam erro genérico (o interceptor já mostra `detail` em toast).

## Goals / Non-Goals

**Goals:**
- Unicidade do caixa aberto garantida pelo banco (não só pela aplicação).
- Uma única função de serviço para "registrar recebimento de venda no caixa", reaproveitada por finalização e quitação (`daily-orders-board`).
- Regra de saldo de gaveta em um único lugar (serviço), consumida por schema, sangria, fechamento e resumo.
- Resumo por canal calculado no backend a partir dos movimentos (fonte auditável).

**Non-Goals:**
- Endpoint `POST /sales/{id}/settle` e quadro de pedidos (change `daily-orders-board`, que chama `register_sale_payments`).
- Múltiplos caixas físicos/terminais, turnos por operador ou caixa por estabelecimento (sistema é mono-loja).
- Troco: pagamento em dinheiro continua igual ao valor devido (o checkout já calcula troco só na tela).
- Reabrir caixa fechado, editar/excluir movimentos, relatórios de período (`sales-reports`).
- Impressão do fechamento.

## Decisions

### 1. Unicidade: índice único parcial + verificação no serviço
**Decisão**: `CREATE UNIQUE INDEX ux_cash_registers_single_open ON cash_registers ((true)) WHERE status = 'OPEN';` (também declarado no model via `Index(..., postgresql_where=...)` para bancos novos criados por `create_all`). `open_register` verifica primeiro (`get_current_register`) e responde 409 "Já existe um caixa aberto (id=N)"; se o `INSERT` falhar com `IntegrityError` (corrida), faz rollback e responde o mesmo 409.
**Rationale**: a checagem da aplicação dá mensagem amigável; o índice fecha a janela de corrida entre duas aberturas simultâneas.
**Alternativa**: lock de tabela/advisory lock na abertura. Rejeitada: mais código e não protege contra escrita fora da API.

### 2. Quem pode abrir: qualquer usuário autenticado
**Decisão**: mantém `POST /cash-registers/` com `get_current_user`; sangria, suprimento e fechamento continuam `require_admin`. `CashRegister.user_id` passa a significar "quem abriu" (exposto como `opened_by_name`); nova coluna `closed_by_user_id` (FK users, nullable) exposta como `closed_by_name`.
**Rationale**: o primeiro operador do dia precisa conseguir abrir sem depender do ADMIN; fechamento é conferência de dinheiro, decisão administrativa (comportamento atual preservado).
**Alternativa**: abrir só ADMIN. Rejeitada: bloquearia a operação quando o dono não está.

### 3. `GET /cash-registers/current` e compatibilidade de `my-open`
**Decisão**: `GET /current` → `CashRegisterOut | None` (200 com `null`, mesmo padrão de `GET /sales/current`), declarado **antes** de `/{register_id}`. `GET /my-open` vira alias depreciado: retorna o caixa compartilhado ou 404 (comportamento HTTP antigo). Frontend migra para `getCurrent()`.
**Rationale**: evita o toast de erro do interceptor quando não há caixa; não quebra clientes antigos.

### 4. Vínculo venda ↔ caixa e função reutilizável
**Decisão**: `Sale.cash_register_id` (FK `cash_registers.id` `ON DELETE RESTRICT`, nullable, index) + relação `Sale.cash_register`. Em `CashRegisterService`:
- `get_current_register(db) -> CashRegister | None`.
- `require_open_register(db, lock: bool = True) -> CashRegister`: busca o caixa OPEN com `SELECT ... FOR UPDATE` (serializa com o fechamento); se não houver → `HTTPException(409, "Nenhum caixa aberto. Abra o caixa para finalizar vendas.")`.
- **`register_sale_payments(db, sale, payments, user_id) -> CashRegister`**: `payments` são objetos `Payment` já adicionados à sessão (com `method`/`amount`); chama `require_open_register`, define `sale.cash_register_id = register.id` e cria um `CashMovement(type=SALE, amount=p.amount, payment_method=p.method, sale_id=sale.id, user_id=user_id, description=f"Venda #{sale.id}")` por pagamento. **Não faz commit** — participa da transação do chamador. Lista vazia apenas vincula.
- **`register_sale_cancellation(db, sale, user_id) -> CashRegister`**: idem, criando `SALE_CANCEL` por `sale.payments` no caixa aberto atual (description `Estorno venda #id`). Não altera `sale.cash_register_id` (mantém o caixa de origem).
**Rationale**: a quitação de PENDING (`daily-orders-board`) só precisa criar `Payment`s, chamar `register_sale_payments` e mudar o status, sem duplicar regras.

### 5. Finalização e reservas PENDING
**Decisão**: em `finalize_sale`, logo após as validações de itens/pagamento e **antes** da baixa de estoque, `register = CashRegisterService.require_open_register(db)` (dentro do `try`, com rollback). Após criar os `Payment`s (`db.flush()`), chama `register_sale_payments(db, sale, created_payments, user_id)`. Reserva (PENDING) também exige caixa e grava `sale.cash_register_id = register.id` sem movimentos (chamada com lista vazia). Na quitação futura, `register_sale_payments` **sobrescreve** `cash_register_id` com o caixa que recebeu o dinheiro.
**Rationale**: (a) vincular a reserva permite mostrar "pedidos a receber" no resumo do caixa do dia; (b) exigir caixa também para reservas evita pedidos "fora de caixa" e mantém regra única e simples para o operador; (c) `cash_register_id` final = caixa que recebeu o dinheiro, coerente com os movimentos.
**Alternativa**: reservas sem caixa. Rejeitada: pedidos de delivery noturnos ficariam sem vínculo e o resumo não mostraria o "a receber".

### 6. Forma de pagamento e venda no movimento; canal derivado
**Decisão**: `CashMovement.payment_method` (`Enum(PaymentMethodEnum)` → reutiliza o tipo PG `paymentmethodenum`, nullable; preenchido só em SALE/SALE_CANCEL) e `CashMovement.sale_id` (FK `sales.id` `ON DELETE SET NULL`, nullable, index). O canal **não** é gravado: é derivado de `sale.order_type` (nulo → `COUNTER`; PICKUP/DELIVERY → `DELIVERY`) via helper `sale_channel(order_type)` e enum Python-only `SalesChannelEnum` (COUNTER/DELIVERY) nos schemas — sem tipo no banco. `order_type` é imutável após a finalização (`update_order_details` só em OPEN), então a derivação é estável.
**Rationale**: evita duplicar dados e um novo enum PG; `sales-reports` pode reaproveitar o helper (e diferenciar PICKUP/DELIVERY).
**Alternativa**: coluna `channel` no movimento. Rejeitada: redundante.

### 7. Saldo de gaveta somente em dinheiro, regra única
**Decisão**: `CashRegisterService.get_cash_balance(register) -> Decimal` (substitui `get_balance`): `+` OPENING, SUPRIMENTO, SALE com `payment_method == CASH`; `−` SANGRIA, SALE_CANCEL com CASH; CLOSING ignorado. `CashRegisterOut.compute_balance` passa a usar a mesma função (importada do serviço; ou propriedade `CashRegister.cash_balance` no model chamada pelos dois) para eliminar a duplicação. Sangria e `close_register` (expected) usam essa função.
**Rationale**: a gaveta só contém dinheiro; CARD/PIX são conferidos pelo resumo por forma de pagamento.

### 8. Estorno no cancelamento
**Decisão**: novo valor `CashMovementTypeEnum.SALE_CANCEL`. `cancel_sale`: se `status == PAID` → `register_sale_cancellation` (exige caixa aberto; 409 "Nenhum caixa aberto para registrar o estorno"; o estorno vai para o caixa aberto **atual**, mesmo que a venda pertença a caixa já fechado). OPEN/PENDING → sem movimentos e sem exigir caixa. Venda PAID antiga sem `cash_register_id` (anterior à mudança) segue a mesma regra (o dinheiro sai da gaveta atual). Estorno não valida saldo (não bloqueia devolução). A checagem do caixa acontece antes do estorno de estoque; todo o cancelamento fica em uma transação.
**Rationale**: caixa fechado é imutável (conferência já feita); o dinheiro devolvido sai da gaveta que está aberta.
**Alternativa**: permitir cancelar sem caixa e registrar o estorno "pendente". Rejeitada: complexidade e saldo inconsistente.

### 9. Resumo (`GET /cash-registers/{id}/summary`)
**Decisão**: `CashRegisterService.build_summary(db, register) -> dict` em Python sobre `register.movements` com `selectinload(CashMovement.sale)` (volume diário pequeno). Schema `CashRegisterSummaryOut`:
`register_id, status, opened_at, closed_at, opened_by_name, closed_by_name, opening_amount, suprimentos_total, sangrias_total, gross_total, cancellations_total, net_total, by_payment_method: list[{method, amount}]` (sempre CASH/CARD/PIX), `by_channel: list[ChannelSummary]` (sempre COUNTER e DELIVERY: `channel, sales_count, net_total, delivery_fees_total, by_payment_method`), `delivery_fees_total, sales_count, canceled_count, pending_count, pending_total, expected_cash, closing_amount, difference`.
Regras: valores líquidos = SALE − SALE_CANCEL por método/canal; uma venda conta em `sales_count` se tem SALE no caixa e não tem SALE_CANCEL no mesmo caixa; `canceled_count` = vendas com SALE_CANCEL no caixa; `delivery_fees_total` = soma de `sale.delivery_fee` das vendas contadas; `pending_*` = vendas `PENDING` com `cash_register_id == id`. Permissão: OPEN → `get_current_user`; CLOSED → ADMIN (403 caso contrário).
**Rationale**: movimentos são a fonte de verdade do dinheiro recebido; cálculo em Python mantém o código simples e testável.
**Alternativa**: agregação SQL (`GROUP BY`). Adiada: desnecessária no volume atual.

### 10. Histórico (`GET /cash-registers/`)
**Decisão**: `require_admin`; query params `start_date`, `end_date` (`date`, filtro em `opened_at` com fim exclusivo `end_date + 1 dia`), `status`, `page` (≥1, padrão 1), `page_size` (1–100, padrão 20). Resposta `CashRegisterPage {items: list[CashRegisterListItem], total, page, page_size}`; `CashRegisterListItem` = id, status, opened_at, closed_at, opened_by_name, closed_by_name, opening_amount, closing_amount, expected_balance, difference (sem movimentos; saldo via `get_cash_balance` com `selectinload(movements)`). Ordenação `opened_at DESC`.

### 11. Frontend
**Decisão**:
- `core/models/cash-register.model.ts`: `SALE_CANCEL` no enum; `CashMovement` + `payment_method`, `sale_id`; `CashRegister` + `opened_by_name`, `closed_by_name`; novos `CashRegisterSummary`, `ChannelSummary`, `PaymentMethodTotal`, `CashRegisterListItem`, `CashRegisterPage`, `CashRegisterListParams`, tipo `SalesChannel = 'COUNTER' | 'DELIVERY'`.
- `core/services/cash-register.service.ts`: `getCurrent(): Observable<CashRegister | null>`, `list(params)`, `getSummary(id)`; `getMyOpen` removido (sem outros usos).
- `pages/cash-register`: migrar para signals (`register`, `summary`, `history`); `loadRegister()` usa `getCurrent()` e, se houver caixa, `getSummary()`. Cabeçalho "Aberto por {opened_by_name} às {HH:mm}". Cards de resumo "Balcão" e "Delivery (Retirada + Entrega)" + bloco geral (líquido, estornos, a receber, dinheiro esperado). Movimentos: rótulo "Venda (Dinheiro/Cartão/PIX)" e "Estorno"; `isInflow` considera SALE inflow e SALE_CANCEL/SANGRIA outflow. Modal de fechamento mostra esperado e diferença ao vivo. Abas "Caixa atual" / "Histórico" (histórico só se `isAdmin()`), com `app-data-table` + filtros de data e paginação servidor (botões anterior/próximo usando `total`), e painel/modal com o resumo do caixa selecionado (componente de resumo reutilizado, ex.: `pages/cash-register/cash-summary/cash-summary.component.ts` com `@Input summary`).
- `pages/sales`: signal `cashRegister` carregado no `ngOnInit` e reconsultado em `openCheckout()`; sem caixa → banner `.badge--warning`/alerta com `routerLink="/cash-register"` "Ir para o Caixa" e "Continuar" desabilitado. Carrinho continua editável.
- `sale-checkout-modal`: em erro 409 na finalização/reserva, exibir `error.error.detail` em área de erro inline do passo atual (sem fechar o modal) e não disparar o toast genérico adicional de `_finalizeReservation`.

### 12. Migração SQL
**Decisão**: `pdv_API/migrations/single_cash_register.sql` em duas partes — ver Migration Plan.

## Risks / Trade-offs

- [Risco] Deploy do backend antes do SQL → colunas inexistentes quebram queries de `Sale`/`CashMovement`. → Mitigação: script obrigatório antes do deploy, idempotente (`IF NOT EXISTS`), ordem documentada.
- [Risco] Já existem vários caixas OPEN (um por usuário) → criação do índice único falha. → Mitigação: Parte 2 do script fecha automaticamente os excedentes (mantém o mais recente) antes de criar o índice; recomenda-se o ADMIN fechar manualmente pela UI antes (Migration Plan, passo 1).
- [Risco] Esquecer de abrir o caixa paralisa as vendas em horário de pico. → Mitigação: qualquer operador pode abrir; aviso claro na tela de Vendas com atalho; carrinho pode ser montado antes.
- [Risco] Fechamento concorrente com uma finalização em andamento. → Mitigação: `require_open_register` usa `FOR UPDATE` na linha do caixa; `close_register` também carrega o caixa com `FOR UPDATE`; a operação que chegar depois vê o status atualizado (finalização recebe 409).
- [Trade-off] Cancelar venda paga exige caixa aberto. → Aceito: devolução de dinheiro precisa de gaveta; mensagem explícita.
- [Trade-off] Estorno pode deixar o saldo de dinheiro negativo (devolução maior que o disponível). → Aceito e visível no resumo; não bloqueia o atendimento.
- [Trade-off] Vendas PAID anteriores à mudança ficam sem `cash_register_id` e sem movimentos SALE; resumos de caixas antigos mostram vendas 0. → Aceito; sem backfill (não há como saber o caixa de origem com segurança).
- [Risco] `ALTER TYPE ... ADD VALUE` não pode rodar dentro de transação junto com uso do valor. → Mitigação: Parte 1 do script fora de transação (mesmo padrão de `add_pending_status.sql`).
- [Trade-off] Resumo calculado em Python carrega todos os movimentos do caixa. → Aceito para o volume de um dia; migrar para SQL se necessário.

## Migration Plan

0. Garantir que `add_customers.sql` e `add_delivery_zones.sql` foram executados.
1. (Recomendado) ADMIN fecha pela UI todos os caixas abertos, deixando no máximo um. Conferir com `SELECT id, user_id, opened_at FROM cash_registers WHERE status = 'OPEN' ORDER BY opened_at;`.
2. Executar `pdv_API/migrations/single_cash_register.sql`:
   - **Parte 1 (fora de transação)**: `ALTER TYPE cashmovementtypeenum ADD VALUE IF NOT EXISTS 'SALE_CANCEL';`
   - **Parte 2 (`BEGIN; ... COMMIT;`)**:
     - Guarda: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='delivery_fee') THEN RAISE EXCEPTION 'Execute add_delivery_zones.sql antes'; END IF; END $$;`
     - `ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT;`
     - `ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS payment_method paymentmethodenum NULL, ADD COLUMN IF NOT EXISTS sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL;` + `CREATE INDEX IF NOT EXISTS ix_cash_movements_sale_id ON cash_movements (sale_id);`
     - `ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_register_id INTEGER REFERENCES cash_registers(id) ON DELETE RESTRICT;` + `CREATE INDEX IF NOT EXISTS ix_sales_cash_register_id ON sales (cash_register_id);`
     - Correção de dados: para cada caixa OPEN que **não** seja o de maior `opened_at`: inserir movimento `CLOSING` com `amount` = saldo em dinheiro calculado (OPENING + SUPRIMENTO + SALE − SANGRIA; não há SALE/SALE_CANCEL antigos) e `user_id` do próprio caixa, e atualizar `status='CLOSED'`, `closed_at=now()`, `closing_amount` = esse saldo, `notes = coalesce(notes,'') || ' [Fechado automaticamente na migração single-cash-register]'` (diferença 0, auditável pela nota).
     - `CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_registers_single_open ON cash_registers ((true)) WHERE status = 'OPEN';`
   - Sem backfill de `sales.cash_register_id` (vendas antigas ficam nulas; PENDING antigas serão vinculadas ao quitar).
3. Deploy do backend; depois do frontend.
4. Verificar: `GET /cash-registers/current` como OPERATOR; abrir/vender/fechar um caixa de teste.

**Rollback**: código anterior ignora as colunas novas (nullable), mas voltaria a permitir vários caixas — remover antes o índice: `DROP INDEX IF EXISTS ux_cash_registers_single_open;`. Remoção completa: `ALTER TABLE sales DROP COLUMN IF EXISTS cash_register_id; ALTER TABLE cash_movements DROP COLUMN IF EXISTS sale_id, DROP COLUMN IF EXISTS payment_method; ALTER TABLE cash_registers DROP COLUMN IF EXISTS closed_by_user_id;` (o valor `SALE_CANCEL` do enum permanece — PG não remove valores; movimentos com esse tipo devem ser removidos/convertidos antes de voltar ao código antigo, que não o reconhece).
