## 1. Pré-requisitos e migração SQL

- [x] 1.1 Confirmar que `customer-registry` e `delivery-zones-and-fee` estão implementadas (`Sale.delivery_fee`, `Sale.items_total`, `add_delivery_zones.sql` executado)
- [x] 1.2 Criar `pdv_API/migrations/single_cash_register.sql` com cabeçalho (ordem: após `add_delivery_zones.sql`, antes do deploy) e Parte 1 fora de transação: `ALTER TYPE cashmovementtypeenum ADD VALUE IF NOT EXISTS 'SALE_CANCEL';`
- [x] 1.3 Parte 2 (`BEGIN/COMMIT`): guarda de `sales.delivery_fee`; colunas `cash_registers.closed_by_user_id`, `cash_movements.payment_method` (`paymentmethodenum`), `cash_movements.sale_id`, `sales.cash_register_id` com FKs e índices (`IF NOT EXISTS`)
- [x] 1.4 Parte 2: fechamento automático dos caixas OPEN excedentes (mantém o de maior `opened_at`), com movimento `CLOSING` = saldo em dinheiro calculado, `closing_amount` = saldo e nota "[Fechado automaticamente na migração single-cash-register]"
- [x] 1.5 Parte 2: `CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_registers_single_open ON cash_registers ((true)) WHERE status = 'OPEN';`
- [ ] 1.6 Executar o script em base de desenvolvimento com 2+ caixas abertos e validar que resta um e que o índice impede um segundo `OPEN`

## 2. Backend — Models

- [x] 2.1 Em `pdv_API/app/models/cash_register.py`: adicionar `SALE_CANCEL` a `CashMovementTypeEnum` (comentários atualizados: SALE = venda por forma de pagamento)
- [x] 2.2 `CashMovement`: colunas `payment_method` (`Enum(PaymentMethodEnum)`, nullable) e `sale_id` (FK `sales.id` `ON DELETE SET NULL`, index) + relação `sale`
- [x] 2.3 `CashRegister`: coluna `closed_by_user_id` + relações `opened_by`/`closed_by` (foreign_keys explícitas, mantendo `user` back_populates), propriedades `opened_by_name`/`closed_by_name`, `__table_args__` com `Index('ux_cash_registers_single_open', text('(true)'), unique=True, postgresql_where=...)`; atualizar docstring ("caixa único do estabelecimento")
- [x] 2.4 Em `pdv_API/app/models/sale.py`: `cash_register_id` (FK `cash_registers.id` `ON DELETE RESTRICT`, nullable, index) e relação `cash_register`

## 3. Backend — Schemas

- [x] 3.1 Em `app/schemas/schemas.py`: `CashMovementOut` + `payment_method`, `sale_id`; `CashRegisterOut` + `opened_by_name`, `closed_by_name`; `compute_balance` passa a usar a regra única de saldo em dinheiro (SALE/SALE_CANCEL só com CASH)
- [x] 3.2 Criar `SalesChannelEnum` (COUNTER/DELIVERY, Python-only), `PaymentMethodTotal`, `ChannelSummary`, `CashRegisterSummaryOut` conforme design (decisão 9)
- [x] 3.3 Criar `CashRegisterListItem` e `CashRegisterPage` (items, total, page, page_size)
- [x] 3.4 `SaleOut` ganha `cash_register_id: Optional[int]`

## 4. Backend — CashRegisterService

- [x] 4.1 `get_cash_balance(register)` (substitui `get_balance`) com a regra de dinheiro; usar em `create_sangria`, `close_register` e no schema
- [x] 4.2 `get_current_register(db)` e `require_open_register(db, lock=True)` (`with_for_update`, 409 "Nenhum caixa aberto. Abra o caixa para finalizar vendas.")
- [x] 4.3 `open_register`: checar caixa OPEN global (409 "Já existe um caixa aberto (id=N)") e converter `IntegrityError` do índice em 409 com rollback
- [x] 4.4 `register_sale_payments(db, sale, payments, user_id)`: vincula `sale.cash_register_id` ao caixa aberto e cria um movimento `SALE` por pagamento (`payment_method`, `sale_id`, descrição "Venda #id"), sem commit
- [x] 4.5 `register_sale_cancellation(db, sale, user_id)`: cria `SALE_CANCEL` por pagamento no caixa aberto atual (409 "Nenhum caixa aberto para registrar o estorno"), sem commit e sem alterar `sale.cash_register_id`
- [x] 4.6 `close_register`: carregar com `FOR UPDATE`, gravar `closed_by_user_id`, expected via `get_cash_balance`
- [x] 4.7 `build_summary(db, register)` conforme decisão 9 (líquidos por método e canal via `sale_channel(order_type)`, `sales_count`, `canceled_count`, `delivery_fees_total`, `pending_count/total`, `expected_cash`, `difference`)
- [x] 4.8 `list_registers(db, start_date, end_date, status, page, page_size)` com `total`, ordenação `opened_at DESC` e `selectinload(movements)`
- [x] 4.9 Manter `get_my_open_register` como wrapper de `get_current_register` (404 se nenhum) para o alias legado

## 5. Backend — Router `/cash-registers`

- [x] 5.1 `GET /current` (`CashRegisterOut | None`) declarado antes de `/{register_id}`
- [x] 5.2 `GET /my-open` mantido com docstring "Depreciado — use /current"
- [x] 5.3 `GET /` (ADMIN) com `start_date`, `end_date`, `status`, `page` (≥1), `page_size` (1–100) → `CashRegisterPage`
- [x] 5.4 `GET /{register_id}/summary` → `CashRegisterSummaryOut` (404 inexistente; caixa CLOSED só ADMIN → 403)

## 6. Backend — SaleService

- [x] 6.1 `finalize_sale`: após validações, `require_open_register` (dentro do `try`, antes da baixa de estoque); criar `Payment`s, `db.flush()` e chamar `register_sale_payments(db, sale, payments_criados, user_id)`; reserva PENDING chama com lista vazia (apenas vínculo)
- [x] 6.2 `cancel_sale`: para venda `PAID`, chamar `register_sale_cancellation` antes do estorno de estoque (mesma transação, `HTTPException` relançada sem virar 500); OPEN/PENDING sem movimentos
- [x] 6.3 Ajustar o `except` de `cancel_sale` para relançar `HTTPException` (hoje converte tudo em 500)

## 7. Frontend — Models e serviço

- [x] 7.1 Em `pdv_View/src/app/core/models/cash-register.model.ts`: `SALE_CANCEL`, campos novos de `CashMovement`/`CashRegister`, tipos `SalesChannel`, `PaymentMethodTotal`, `ChannelSummary`, `CashRegisterSummary`, `CashRegisterListItem`, `CashRegisterPage`, `CashRegisterListParams`; exportar no barrel
- [x] 7.2 `core/models/sale.model.ts`: `cash_register_id: number | null`
- [x] 7.3 Em `core/services/cash-register.service.ts`: `getCurrent()`, `list(params)` (HttpParams), `getSummary(id)`; remover `getMyOpen`

## 8. Frontend — Página Caixa

- [x] 8.1 `pages/cash-register/cash-register.component.ts`: migrar estado para signals (`register`, `summary`), `loadRegister()` com `getCurrent()` + `getSummary()`; recarregar após abrir, sangria, suprimento e fechamento
- [x] 8.2 Cabeçalho "Aberto por {opened_by_name} às {HH:mm}"; formulário de abertura para qualquer usuário sem caixa aberto (sem toast de erro)
- [x] 8.3 Criar componente reutilizável de resumo (ex.: `pages/cash-register/cash-summary/`) com blocos "Balcão" e "Delivery (Retirada + Entrega)" (vendas, total, Dinheiro/Cartão/PIX, taxas) e bloco geral (líquido, estornos, a receber, dinheiro esperado, contagem/diferença quando fechado)
- [x] 8.4 Movimentos: rótulos "Venda (Dinheiro|Cartão|PIX)" e "Estorno"; `isInflow` com SALE entrada e SALE_CANCEL/SANGRIA saída
- [x] 8.5 Modal de fechamento: exibir dinheiro esperado e diferença calculada ao digitar a contagem
- [x] 8.6 Abas "Caixa atual" / "Histórico" (histórico só ADMIN): filtros de data, `app-data-table` (Abertura, Fechamento, Aberto por, Fechado por, Esperado, Contado, Diferença, Status), paginação servidor anterior/próximo e abertura do resumo do caixa selecionado
- [x] 8.7 Estilos em `cash-register.scss` com tokens de `src/styles.scss`, responsivo (blocos empilhados em telas estreitas)

## 9. Frontend — Vendas e checkout

- [x] 9.1 `pages/sales/sales.component.ts`: signal `cashRegister` carregado no `ngOnInit` via `getCurrent()` e reconsultado em `openCheckout()` (não abre o modal se não houver caixa)
- [x] 9.2 `pages/sales/sales.html`: aviso "Caixa fechado — abra o caixa para finalizar vendas" com `routerLink="/cash-register"` "Ir para o Caixa"; botão "Continuar" desabilitado sem caixa (carrinho permanece editável)
- [x] 9.3 `sale-checkout-modal.component.ts`: em erro 409 de `finalizeSale`/`_finalizeReservation`, exibir `error.error.detail` inline no passo atual, manter o modal aberto e remover o toast genérico duplicado da reserva

## 10. Testes manuais

- [x] 10.1 API: OPERATOR abre caixa (201, `opened_by_name`); segundo `POST` por ADMIN → 409; `GET /current` retorna o mesmo caixa para ambos; sem caixa → 200 `null`; `my-open` sem caixa → 404
- [x] 10.2 API: finalizar Balcão sem caixa → 409, venda OPEN e estoque intacto; com caixa → PAID, `cash_register_id` preenchido, movimentos SALE por pagamento com `payment_method` e `sale_id`
- [x] 10.3 API: pagamento misto CASH+PIX+CARD → `current_balance` aumenta só pelo CASH; sangria acima do dinheiro → 422
- [x] 10.4 API: Entrega não paga → PENDING vinculada sem movimentos; resumo mostra `pending_count`/`pending_total`
- [x] 10.5 API: cancelar PAID com caixa aberto → SALE_CANCEL por pagamento e saldo reduzido; cancelar PAID sem caixa → 409 e venda continua PAID; cancelar venda de caixa fechado com outro caixa aberto → estorno no caixa atual, caixa antigo intacto; cancelar PENDING → sem movimentos
- [x] 10.6 API: resumo com Balcão 40 CASH, Retirada 25 PIX, Entrega 57 CARD (taxa 7) → COUNTER 1/40, DELIVERY 2/82, taxas 7, `sales_count` 3; OPERATOR consultando resumo de caixa fechado → 403
- [x] 10.7 API: fechar como ADMIN → `closed_by_name`, `expected_balance`, `difference`; OPERATOR → 403; após fechar, finalizar venda → 409
- [x] 10.8 API: `GET /cash-registers/?start_date&end_date&page&page_size` como ADMIN (ordem, `total`, filtros); OPERATOR → 403
- [ ] 10.9 UI: OPERATOR vê caixa aberto pelo ADMIN com "Aberto por…", resumo Balcão vs Delivery e sem botões admin; sem caixa vê formulário de abertura sem toast de erro
- [ ] 10.10 UI: tela de Vendas sem caixa mostra aviso e bloqueia "Continuar"; fechar o caixa durante o checkout e confirmar → mensagem inline, modal permanece
- [ ] 10.11 UI: ADMIN fecha caixa vendo esperado/diferença ao vivo; aba Histórico lista caixas, filtra por período e mostra o resumo do caixa selecionado
