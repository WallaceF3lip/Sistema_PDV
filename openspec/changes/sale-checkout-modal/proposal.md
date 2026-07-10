## Why

O painel de detalhes do pedido (tipo de compra, dados do cliente, endereço, forma de pagamento) está embutido diretamente no carrinho, poluindo a tela principal de vendas e misturando responsabilidades de seleção de itens com coleta de dados do pedido. Mover esse fluxo para um modal dedicado e componentizado melhora a separação de responsabilidades, simplifica manutenção futura e torna o fluxo do operador mais claro e linear.

## What Changes

- **BREAKING**: O painel de detalhes do pedido é removido do carrinho. O botão "Cobrar" é substituído por "Continuar"
- Novo componente `CheckoutModalComponent` (`sale-checkout-modal`) que encapsula todo o fluxo de checkout em um único modal multi-etapa:
  - **Etapa 1 — Tipo de pedido**: seletor visual entre Balcão, Retirada e Entrega
  - **Etapa 2 — Detalhes**: campos condicionais por tipo (nome do cliente, observação, horário, endereço, telefone, forma de pagamento prevista, flag "já pago") — exibida apenas quando o tipo não for Balcão
  - **Etapa 3 — Pagamento**: modal de pagamento existente, exibida apenas quando aplicável (Balcão sempre, ou pedidos marcados como "já pago")
- O `SalesComponent` passa a abrir o `CheckoutModalComponent` ao clicar em "Continuar", comunicando resultado via `EventEmitter` ou `signal`
- O carrinho retorna ao seu estado original: apenas lista de itens e total, sem campos de formulário

## Capabilities

### New Capabilities
- `sale-checkout-modal`: Componente modal multi-etapa que encapsula seleção de tipo de pedido, coleta de dados e pagamento

### Modified Capabilities

## Impact

- **Frontend**:
  - `pdv_View/src/app/pages/sales/sales.component.ts` e `sales.html` — remoção do painel de detalhes, substituição do botão "Cobrar" por "Continuar"
  - `pdv_View/src/app/pages/sales/sales.scss` — remoção dos estilos do painel inline
  - Novo diretório `pdv_View/src/app/pages/sales/sale-checkout-modal/` com `sale-checkout-modal.component.ts`, `.html` e `.scss`
- **Sem alterações no backend** — a API já suporta todos os casos necessários
