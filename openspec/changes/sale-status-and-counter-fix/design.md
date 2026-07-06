## Context

Dois bugs estão ativos no fluxo de checkout:

**Bug 1 — Status incorreto em reservas**: `SaleService.finalize_sale` sempre atribui `SaleStatusEnum.PAID` ao fechar a venda, mesmo quando `is_reservation = True` (Entrega ou Retirada com pagamento posterior). O resultado é que pedidos que ainda não foram pagos aparecem no banco como `PAID`, impossibilitando distinguir o que já foi pago do que está aguardando.

**Bug 2 — Balcão não persiste customer_name/notes**: `advanceStep()` no `CheckoutModalComponent` pula a etapa de Detalhes para o tipo Balcão e vai direto para o pagamento sem chamar `PATCH /sales/{id}/order-details`. Os campos `customer_name`, `notes` e `order_type` nunca são enviados ao backend nesse fluxo.

## Goals / Non-Goals

**Goals:**
- Introduzir `SaleStatusEnum.PENDING` para representar pedidos reservados (entregues/retirados com pagamento posterior)
- `finalize_sale` usa `PENDING` quando `is_reservation = True`, `PAID` em todos os outros casos
- `cancel_sale` aceita cancelamento de vendas `PENDING` com estorno de estoque (mesma lógica de `PAID`)
- Migração Alembic para adicionar `PENDING` ao tipo enum no PostgreSQL
- Frontend: `SaleStatusEnum` Angular recebe `PENDING`
- Frontend: `advanceStep()` para Balcão chama `updateOrderDetails` com `customer_name`, `notes` e `order_type: null` antes de ir para pagamento

**Non-Goals:**
- Nenhuma alteração no fluxo de pagamento em si
- Transição de `PENDING` para `PAID` após receber o pagamento da entrega (fora de escopo — seria uma feature de gestão de pedidos futura)
- Alterações na tela de relatórios ou listagem de vendas

## Decisions

### 1. Novo status `PENDING` vs. reutilizar `PAID` com flag

**Decisão**: Novo valor `PENDING` no enum `SaleStatusEnum`.

**Rationale**: `PAID` semanticamente significa "pagamento recebido". Usar `PAID` para reservas sem pagamento polui o modelo de domínio e complica qualquer relatório financeiro futuro. `PENDING` é semanticamente correto para "pedido confirmado, aguardando pagamento".

**Alternativa considerada**: Campo booleano `awaiting_payment` em `Sale`. Rejeitado porque dispersa o estado em dois campos (`status` + `awaiting_payment`) em vez de concentrar em um.

### 2. `cancel_sale` com lógica de PENDING

**Decisão**: Tratar `PENDING` igual a `PAID` no cancelamento — reverter estoque antes de cancelar.

**Rationale**: Quando uma venda é reservada (`PENDING`), o estoque já foi baixado (em `finalize_sale`). Cancelar sem estornar geraria inconsistência de estoque. A lógica de estorno já existe para `PAID` e pode ser reaproveitada.

### 3. Balcão: salvar order-details antes de inicializar pagamento

**Decisão**: Em `advanceStep()`, quando `isCounter()`, chamar `saleService.updateOrderDetails()` com `{ customer_name, notes, order_type: null }` e só após o sucesso da requisição inicializar as entradas de pagamento e avançar para a etapa de PAYMENT.

**Rationale**: O frontend já tem o método `_buildOrderDetailsPayload()` mas ele só é chamado em `confirmDetails()` (etapa de Detalhes). Para Balcão, `confirmDetails()` nunca é chamado. Mover ou reutilizar a lógica de PATCH diretamente em `advanceStep()` é a menor mudança possível.

**Alternativa considerada**: Sempre salvar order-details ao finalizar (em `finalizeSale()`). Rejeitado porque adiciona latência na etapa crítica de finalização e mistura responsabilidades.

## Risks / Trade-offs

- **[Risco] Migração do enum no PostgreSQL**: `ALTER TYPE ... ADD VALUE` não pode ser executado dentro de uma transaction em versões antigas do Postgres. → Mitigação: usar `COMMIT` antes do `ALTER TYPE` na migração Alembic (já suportado pelo Alembic via `execute_with_privilege`).
- **[Risco] Registros existentes com status PAID que deveriam ser PENDING**: dados já persistidos no banco não serão corrigidos automaticamente. → Aceitável para MVP; dado histórico permanece como está.
- **[Trade-off] `advanceStep()` para Balcão agora tem uma chamada de rede extra**: pequena latência antes de mostrar a tela de pagamento. Aceitável — o PATCH é rápido e evita dados perdidos.

## Migration Plan

1. Gerar migração: `alembic revision --autogenerate -m "add PENDING to sale status enum"`
2. Revisar o arquivo gerado — garantir que o `ALTER TYPE salestatusenum ADD VALUE 'PENDING'` está correto
3. Aplicar localmente: `alembic upgrade head`
4. Deploy do backend
5. Deploy do frontend

**Rollback**: `PENDING` pode ser deixado no enum sem uso sem impacto. O código pode ser revertido para `PAID` nas reservas sem remoção do valor do enum (remoção de valor de enum no PostgreSQL requer recriação da coluna).

## Open Questions

- Nenhuma.
