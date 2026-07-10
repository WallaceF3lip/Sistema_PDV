## Context

O PDV possui um modal de pagamento (`sales.html` + `sales.component.ts`) que hoje usa um único sinal `selectedMethod: signal<PaymentMethodEnum>` para capturar a forma de pagamento. Ao finalizar, envia um array `payments[]` com uma única entrada cobrindo 100% do total.

O backend (`FinalizeSaleRequest`) já aceita um array de pagamentos com qualquer número de entradas, cada uma contendo `method` e `amount`. Não há nenhuma restrição de backend a remover ou contornar. A mudança é puramente de frontend.

O projeto usa Angular 17+ standalone com Signals; não usa NgRx, RxJS Subjects nem formulários reativos — estado local via `signal()` e `computed()`.

## Goals / Non-Goals

**Goals:**
- Permitir que o operador adicione N entradas de pagamento ao mesmo modal de pagamento.
- Mostrar em tempo real o valor restante a pagar (total − soma das entradas).
- Manter o cálculo de troco quando uma das entradas for CASH.
- Bloquear "Finalizar Venda" até que a soma cubra exatamente (ou supere, no caso de dinheiro) o total.
- Manter responsividade: mobile-first, funcional em telas ≥ 320px.
- Não quebrar o fluxo de venda com um único método de pagamento (caso mais comum).

**Non-Goals:**
- Integração com TEF/maquininha real.
- Arredondamento ou split automático de valores.
- Histórico de pagamentos parciais antes de finalizar.
- Alterações no backend.

## Decisions

### 1 — Representação do estado como array de entradas (`PaymentEntry[]`)

**Decisão:** substituir `selectedMethod` e `cashReceived` por `signal<PaymentEntry[]>([])`, onde `PaymentEntry = { method: PaymentMethodEnum; amount: number }`.

**Alternativas consideradas:**
- Manter `selectedMethod` e adicionar um segundo campo opcional → cria tratamento especial para o caso N=1 e não generaliza para 3+ métodos.
- Usar `FormArray` de Reactive Forms → introduz dependência extra (`ReactiveFormsModule`) sem ganho funcional real, dado que o formulário é simples.

**Razão:** array de entradas generaliza o caso de 1 e N métodos com o mesmo código, mapeia diretamente para o `PaymentIn[]` do backend e é idiomático com Signals.

### 2 — UX: valor distribuído manualmente pelo operador

**Decisão:** ao adicionar uma entrada, o campo de valor é pré-preenchido com o valor restante (total − soma anterior), facilitando o caso mais comum (segunda entrada cobre o resto), mas permitindo edição livre.

**Alternativas consideradas:**
- Split automático 50/50 → confuso para valores ímpares.
- Valor zero obrigatório que o usuário preenche → mais cliques, mais lento no PDV.

**Razão:** velocidade de operação é crítica no PDV; pré-preencher o restante reduz digitação sem tirar controle do operador.

### 3 — Troco apenas na entrada CASH

**Decisão:** calcular e exibir troco somente quando *alguma* entrada com `method === CASH` existir e o valor dessa entrada superar a parcela restante.

**Razão:** troco é conceito exclusivo de dinheiro físico. PIX e cartão não aceitam "troco".

### 4 — Estrutura de componente: modal inline no template

**Decisão:** manter o modal como bloco `@if` inline no `sales.html`, sem extraí-lo para um componente filho.

**Alternativas consideradas:**
- Criar `PaymentModalComponent` separado → mais limpo, mas o escopo desta mudança é apenas o fluxo de pagamento; refatorar a decomposição do componente está fora de escopo.

**Razão:** minimiza superfície de mudança e risco de regressão.

### 5 — Limite de entradas: máximo 3

**Decisão:** limitar a 3 entradas de pagamento (PIX + Cartão + Dinheiro = todos os métodos disponíveis).

**Razão:** cada método pode aparecer no máximo uma vez de forma lógica; o backend aceita repetições mas o produto atual não tem caso de uso para pagar duas vezes no cartão.

## Risks / Trade-offs

- **Operador insere valor errado na última entrada** → o botão "Finalizar" só habilita quando a soma bate; o campo de valor restante dá feedback visual imediato. Mitigação suficiente para MVP.
- **Valores com casas decimais inconsistentes** (ex: R$ 0,001 de diferença por float) → comparar com tolerância de R$ 0,01 ou truncar para 2 casas ao somar. Mitigação: usar `Math.round(value * 100) / 100` antes de comparar.
- **Regres​são no fluxo de pagamento único** → cenário coberto pelos cenários do spec; testar manualmente antes de merge.

## Migration Plan

1. Atualizar `sales.component.ts`: novos sinais, computed e método `finalizeSale`.
2. Atualizar `sales.html`: nova seção de entradas no modal.
3. Atualizar `sales.scss`: estilos da lista de entradas e badge de restante.
4. Smoke test manual: venda com 1 método, venda com 2 métodos, venda com CASH + troco.

Rollback: reverter os três arquivos; sem migrações de banco ou contrato de API alterado.

## Open Questions

- O backend rejeita entradas com `amount: 0`? (provável que sim — validar ao implementar e filtrar antes de enviar.)
