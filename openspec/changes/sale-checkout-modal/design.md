## Context

O `SalesComponent` atual mistura duas responsabilidades distintas: (1) seleção de produtos e gestão do carrinho, e (2) coleta de dados do pedido e processamento do pagamento. O painel de detalhes ocupa espaço fixo no carrinho, está sempre visível mesmo quando não é necessário (venda balcão simples), e qualquer alteração no fluxo de checkout exige editar os três arquivos do `SalesComponent`.

O código atual já implementa todo o suporte de backend e os signals/lógica de checkout no componente. Este change é uma refatoração de UI pura: extrair o fluxo de checkout para um componente filho dedicado, acionado por um modal.

## Goals / Non-Goals

**Goals:**
- Extrair o fluxo de checkout (tipo de pedido + detalhes + pagamento) para `CheckoutModalComponent`
- Fluxo linear no modal: Etapa 1 (tipo) → Etapa 2 (detalhes, condicional) → Etapa 3 (pagamento, condicional)
- `SalesComponent` fica responsável apenas por: listar produtos, gerenciar carrinho e abrir o modal
- Comunicação entre componentes via `@Input` / `@Output` com tipagem clara
- Manter 100% da lógica de negócio existente (validações, reserva, pagamento misto)

**Non-Goals:**
- Alterações no backend ou nos serviços Angular
- Redesign visual dos elementos existentes (botões de método de pagamento, etc.)
- Suporte a múltiplas vendas simultâneas
- Animações de transição entre etapas além das já existentes no projeto

## Decisions

### 1. Componente filho `CheckoutModalComponent` vs. serviço de modal genérico

**Decisão**: Componente standalone `CheckoutModalComponent` instanciado diretamente no template do `SalesComponent` via `@if`.

**Rationale**: O checkout é específico de vendas — não há necessidade de um serviço de modal genérico (que adicionaria complexidade sem benefício nesse escopo). Um componente declarativo com `@Input`/`@Output` é mais fácil de testar e manter. O Angular 17+ com `@if` no template oferece lazy rendering nativo.

**Alternativa considerada**: Serviço `ModalService` com `createComponent`. Rejeitado pela complexidade desnecessária para um caso de uso único.

---

### 2. Gerenciamento de estado: signals no filho vs. no pai

**Decisão**: `CheckoutModalComponent` gerencia seu próprio estado interno (etapa atual, dados do formulário). O `SalesComponent` passa apenas `sale` como `@Input` e recebe eventos `(completed)` e `(cancelled)` como `@Output`.

**Rationale**: Isola a complexidade do formulário dentro do componente responsável por ele. O `SalesComponent` não precisa saber em qual etapa o checkout está. Facilita reuso futuro do componente em outros contextos (ex: editar pedido existente).

**Alternativa considerada**: Manter todos os signals no `SalesComponent` e passar/receber via bindings granulares. Rejeitado porque não resolve o problema de acoplamento.

---

### 3. Estrutura de etapas: enum vs. número sequencial

**Decisão**: Enum `CheckoutStep` com valores `TYPE`, `DETAILS`, `PAYMENT` no componente filho.

**Rationale**: Enum é mais legível e seguro que índices numéricos. Facilita adicionar etapas futuras (ex: confirmação) sem renumerar. O template usa `@switch` ou `@if` com comparações de enum.

---

### 4. Etapa de detalhes condicional para tipo "Balcão"

**Decisão**: Para o tipo Balcão (`null`/`COUNTER`), a etapa de detalhes é pulada automaticamente — ao confirmar o tipo, avança direto para pagamento.

**Rationale**: Balcão não precisa de dados de cliente ou entrega. Pular a etapa melhora a velocidade do operador para o caso mais comum.

---

### 5. Localização do novo componente

**Decisão**: `pdv_View/src/app/pages/sales/sale-checkout-modal/` como subdiretório de `sales`.

**Rationale**: O componente é contextualmente específico de vendas, não é compartilhado globalmente. Colocá-lo como filho direto de `sales/` mantém a coesão sem poluir `shared/`.

## Risks / Trade-offs

- **[Risco] Regressão na lógica de reserva/pagamento ao mover código**: a lógica de `openPayment`, `finalizeReservation` e `finalizeSale` é movida e não apenas copiada. → Mitigação: implementar em etapas, testando cada fluxo (balcão, retirada pago, retirada não-pago, entrega pago, entrega reserva) manualmente após a migração.
- **[Trade-off] Dois componentes para manter em vez de um**: a separação aumenta o número de arquivos. É intencional e justificado pelo ganho de manutenibilidade.
- **[Risco] Perda de estado se o usuário fechar e reabrir o modal sem finalizar**: o modal é destruído ao fechar (`@if`), os campos do formulário são perdidos. → Mitigação: ao reabrir, preencher os campos com os dados já salvos na `sale` (via `updateOrderDetails` anterior ou via `sale` passada como `@Input`).

## Migration Plan

1. Criar `CheckoutModalComponent` como componente standalone vazio
2. Mover a lógica de checkout do `SalesComponent` para o novo componente
3. Substituir o painel inline e o modal de pagamento no `sales.html` pela tag `<app-sale-checkout-modal>`
4. Remover signals e métodos de checkout do `SalesComponent`
5. Testar todos os fluxos manualmente

Rollback: reverter os arquivos modificados — sem impacto em banco ou API.

## Open Questions

- Nenhuma.
