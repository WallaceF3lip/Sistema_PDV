## Context

O modelo `Sale` atual armazena apenas `user_id`, `status`, `total_amount`, `opened_at` e `closed_at`. Não há suporte a dados do cliente, tipo de pedido ou informações de entrega. O frontend hoje apresenta apenas o carrinho e o modal de pagamento, sem nenhum formulário de detalhes do pedido.

A demanda é capturar, antes ou durante a finalização, dados como nome do cliente, observação, se o pedido é retirada ou entrega, e — no caso de entrega — horário previsto, endereço, telefone e forma de pagamento (podendo já estar pago).

## Goals / Non-Goals

**Goals:**
- Adicionar campos de detalhes do pedido ao modelo `Sale` no backend
- Novo endpoint `PATCH /{sale_id}/order-details` para salvar detalhes sem finalizar a venda
- Permitir que pedidos do tipo `DELIVERY` sejam reservados sem pagamento imediato
- UI de detalhes do pedido no carrinho com campos condicionais para entrega
- Migração Alembic para as novas colunas

**Non-Goals:**
- Rastreamento de status de entrega (ex: "em rota", "entregue") — fora de escopo
- Notificação ao cliente por SMS/e-mail
- Integração com sistemas de logística externos
- Histórico de alterações nos dados do pedido

## Decisions

### 1. Campos diretos na tabela `sales` vs. tabela separada `sale_delivery`

**Decisão**: Colunas diretas na tabela `sales`.

**Rationale**: A relação é 1:1 (cada venda tem no máximo um conjunto de dados de entrega). Uma tabela separada aumentaria a complexidade de queries e joins sem benefício real nesse escopo. Colunas nullable no modelo existente são suficientes e mais simples de migrar.

**Alternativa considerada**: Tabela `sale_delivery` com FK para `sales`. Rejeitada pela complexidade desnecessária para um MVP.

### 2. Novo endpoint PATCH vs. incluir no POST de abertura / PUT de finalização

**Decisão**: Novo endpoint `PATCH /{sale_id}/order-details`.

**Rationale**: Separar a responsabilidade de "registrar dados do pedido" de "abrir venda" e "finalizar venda" mantém cada endpoint com uma única responsabilidade. O frontend pode salvar os detalhes a qualquer momento enquanto a venda está OPEN, sem precisar finalizar.

**Alternativa considerada**: Incluir os campos no `FinalizeSaleRequest`. Rejeitada porque mistura dados logísticos com dados financeiros e impediria salvar detalhes sem finalizar (reserva).

### 3. Validação condicional de campos de entrega

**Decisão**: Validação no schema Pydantic usando `model_validator`. Se `order_type == DELIVERY`, os campos `delivery_time`, `delivery_address` e `customer_phone` são obrigatórios. `payment_method` e `is_paid` são opcionais (entrega pode ser combinada para pagar na entrega).

**Rationale**: Centraliza a regra de negócio no schema, aproveitando o mecanismo nativo do Pydantic, sem duplicar lógica no service.

### 4. Finalização de pedidos DELIVERY sem pagamento imediato

**Decisão**: No `SaleService.finalize_sale`, se `order_type == DELIVERY` e `is_paid == False`, a lista de pagamentos pode estar vazia. A venda é finalizada com `status = PAID` mas com `total_amount` registrado e sem entradas em `payments`.

**Rationale**: Uma reserva/entrega precisa ser "fechada" no sistema para sair do estado OPEN e não bloquear o caixa do operador. Usar `PAID` (sem payment entries) é mais simples do que criar um novo status `RESERVED`, evitando mudanças em todas as queries existentes que filtram por status.

**Alternativa considerada**: Novo status `RESERVED`. Rejeitada pelo impacto em queries, relatórios e lógica de cancelamento.

### 5. UI: painel inline no carrinho vs. modal separado

**Decisão**: Painel colapsável inline abaixo do cabeçalho do carrinho, antes do footer com total e botão "Cobrar".

**Rationale**: Manter os dados do pedido visíveis enquanto o operador adiciona produtos evita esquecimento. Um modal separado exigiria navegação adicional.

## Risks / Trade-offs

- **[Risco] Migração em produção com Vercel Postgres**: `Base.metadata.create_all` não cria colunas novas em tabelas existentes. → Mitigação: gerar e executar migração Alembic antes do deploy.
- **[Risco] Pedido DELIVERY finalizado sem pagamento não aparece claramente no relatório de caixa**: status `PAID` sem `payments` pode confundir. → Mitigação: no relatório, checar `order_type == DELIVERY AND is_paid == False` para distinguir reservas.
- **[Trade-off] `is_paid` sem rastreamento de quem recebeu o pagamento**: simplificação intencional para MVP. Pode ser expandido futuramente.

## Migration Plan

1. Gerar migração Alembic: `alembic revision --autogenerate -m "add order details to sales"`
2. Revisar o arquivo gerado — garantir que todas as colunas novas são `nullable=True`
3. Aplicar: `alembic upgrade head` (local e em produção via variável `DATABASE_URL`)
4. Deploy do backend com as alterações
5. Deploy do frontend com o novo painel de detalhes

**Rollback**: `alembic downgrade -1` remove as colunas. O código anterior ignora campos extras no JSON.

## Open Questions

- Nenhuma no momento.
