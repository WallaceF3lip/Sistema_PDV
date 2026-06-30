## Why

O modal de pagamento do PDV atualmente só permite selecionar um único método de pagamento por venda. Clientes frequentemente desejam dividir o valor entre dois ou mais meios (ex: parte no cartão e parte em PIX), mas o frontend não suporta esse fluxo — mesmo que o backend já aceite múltiplos pagamentos via `FinalizeSaleRequest.payments[]`.

## What Changes

- Substituir a seleção de método único (`selectedMethod`) por uma lista de parcelas de pagamento (`paymentEntries[]`), cada uma com método e valor.
- Permitir ao operador adicionar múltiplas entradas de pagamento, atribuindo um valor a cada uma.
- Exibir em tempo real o valor já coberto e o valor restante a pagar.
- Validar que a soma dos valores inseridos cobre exatamente o total da venda antes de habilitar "Finalizar Venda".
- Manter suporte ao cálculo de troco quando um dos métodos for Dinheiro (CASH).
- Adaptar o layout do modal para acomodar a lista de parcelas de forma responsiva (mobile e desktop).

## Capabilities

### New Capabilities

- `multi-payment-entry`: UI para adicionar, remover e ajustar múltiplas entradas de pagamento em uma venda, com validação de cobertura total e suporte a troco para dinheiro.

### Modified Capabilities

_(Nenhuma especificação existente com mudança de requisitos — não há `openspec/specs/` prévio.)_

## Impact

- **Frontend — `sales.component.ts`**: Remover `selectedMethod` e `cashReceived` como sinais únicos; introduzir array de entradas de pagamento (`signal<PaymentEntry[]>`); reescrever `canFinalize`, `changeAmount` e `finalizeSale()` para operar sobre a lista.
- **Frontend — `sales.html`**: Redesenhar a seção de pagamento no modal para listar entradas existentes, oferecer botão "Adicionar forma de pagamento" e mostrar o saldo restante.
- **Frontend — `sales.scss`**: Adicionar estilos para a lista de entradas de pagamento e o indicador de saldo restante, responsivos para mobile-first.
- **Modelos**: Nenhuma alteração — `PaymentIn` e `FinalizeSaleRequest` já suportam múltiplos pagamentos.
- **Backend**: Nenhuma alteração necessária.
