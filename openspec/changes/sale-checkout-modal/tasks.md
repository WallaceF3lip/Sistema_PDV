## 1. Criar estrutura do CheckoutModalComponent

- [x] 1.1 Criar diretório `pdv_View/src/app/pages/sales/sale-checkout-modal/`
- [x] 1.2 Criar `sale-checkout-modal.component.ts` como componente standalone com `@Input() sale` e `@Output() completed` / `@Output() cancelled`
- [x] 1.3 Criar `sale-checkout-modal.html` vazio com estrutura base do modal (overlay + card)
- [x] 1.4 Criar `sale-checkout-modal.scss` vazio
- [x] 1.5 Definir enum `CheckoutStep` (`TYPE`, `DETAILS`, `PAYMENT`) no arquivo do componente

## 2. Implementar lógica do CheckoutModalComponent

- [x] 2.1 Declarar signals internos: `currentStep`, `orderType`, `customerName`, `notes`, `deliveryTime`, `deliveryAddress`, `customerPhone`, `deliveryPaymentMethod`, `isPaid`, `isProcessing`
- [x] 2.2 Declarar signals herdados do SalesComponent: `paymentEntries`, `products` (necessário para `getProductName`)
- [x] 2.3 Implementar computed `isDelivery`, `isPickup`, `deliveryFieldsValid`, `canFinalize`, `remainingAmount`, `changeAmount`, `canAddEntry`
- [x] 2.4 Implementar `ngOnInit` para pré-preencher signals com dados já salvos na `sale` recebida via `@Input`
- [x] 2.5 Implementar `advanceStep()`: Balcão → pula para PAYMENT; Retirada/Entrega → vai para DETAILS
- [x] 2.6 Implementar `goBack()`: retorna à etapa anterior correta conforme o tipo selecionado
- [x] 2.7 Mover `_buildOrderDetailsPayload()` do SalesComponent para o CheckoutModalComponent
- [x] 2.8 Implementar `confirmDetails()`: valida campos, salva via `updateOrderDetails`, avança para PAYMENT ou finaliza como reserva
- [x] 2.9 Mover lógica de `finalizeSale()` (com payments) do SalesComponent para o CheckoutModalComponent
- [x] 2.10 Mover lógica de `finalizeReservation()` do SalesComponent para o CheckoutModalComponent
- [x] 2.11 Emitir `completed` após finalização bem-sucedida (pagamento ou reserva)
- [x] 2.12 Implementar `close()` que emite `cancelled` e permite fechar sem finalizar
- [x] 2.13 Mover métodos de `paymentEntries` (`addPaymentEntry`, `removePaymentEntry`, `updateEntryMethod`, `updateEntryAmount`) para o CheckoutModalComponent

## 3. Implementar template do CheckoutModalComponent

- [x] 3.1 Implementar Etapa 1 no template: seletor visual de tipo (Balcão / Retirada / Entrega) com botões e botão "Continuar" desabilitado quando nenhum tipo selecionado
- [x] 3.2 Implementar Etapa 2 no template: campos de nome do cliente e observação (sempre visíveis); campos condicionais de horário, telefone, endereço, forma de pagamento prevista e toggle "Já pago"; botões "Voltar" e "Confirmar"
- [x] 3.3 Implementar Etapa 3 no template: exibição do total, entradas de pagamento misto, indicador de restante, exibição de troco, botão "Finalizar Venda"; botão "Voltar"
- [x] 3.4 Implementar botão ✕ para fechar o modal em todas as etapas

## 4. Implementar estilos do CheckoutModalComponent

- [x] 4.1 Migrar estilos do painel inline (`order-details-panel`, `order-type-selector`, `delivery-fields`, etc.) do `sales.scss` para `sale-checkout-modal.scss`
- [x] 4.2 Migrar estilos do modal de pagamento (`payment-modal`, `payment-entries`, `tender-btn`, etc.) do `sales.scss` para `sale-checkout-modal.scss`
- [x] 4.3 Adicionar estilos de navegação de etapas (indicador de progresso ou cabeçalho com etapa atual)

## 5. Atualizar SalesComponent

- [x] 5.1 Adicionar `import` do `CheckoutModalComponent` no `SalesComponent`
- [x] 5.2 Substituir o botão "Cobrar" por botão "Continuar" no `sales.html`
- [x] 5.3 Adicionar signal `showCheckoutModal` ao `SalesComponent`
- [x] 5.4 Adicionar método `openCheckout()` que seta `showCheckoutModal.set(true)`
- [x] 5.5 Adicionar `<app-sale-checkout-modal>` no `sales.html` com `@if (showCheckoutModal())`, passando `[sale]` e escutando `(completed)` e `(cancelled)`
- [x] 5.6 Implementar handler `onCheckoutCompleted()` que limpa o carrinho e fecha o modal
- [x] 5.7 Implementar handler `onCheckoutCancelled()` que apenas fecha o modal
- [x] 5.8 Remover do `SalesComponent` todos os signals de checkout: `orderType`, `customerName`, `notes`, `deliveryTime`, `deliveryAddress`, `customerPhone`, `deliveryPaymentMethod`, `isPaid`, `showDeliveryError`, `showPayment`, `paymentEntries`
- [x] 5.9 Remover do `SalesComponent` os métodos movidos: `openPayment`, `finalizeReservation`, `finalizeSale`, `_buildOrderDetailsPayload`, `_resetSale`, `addPaymentEntry`, `removePaymentEntry`, `updateEntryMethod`, `updateEntryAmount`
- [x] 5.10 Remover do `sales.html` o bloco `<!-- Order Details Panel -->` e o `<!-- Payment Modal -->`
- [x] 5.11 Remover do `sales.scss` os estilos do painel inline e do modal de pagamento (já migrados)

## 6. Verificação e limpeza

- [ ] 6.1 Testar fluxo Balcão: selecionar produtos → Continuar → Tipo Balcão → Etapa de pagamento → Finalizar
- [ ] 6.2 Testar fluxo Retirada paga: selecionar produtos → Continuar → Retirada → preencher dados → marcar como pago → Etapa de pagamento → Finalizar
- [ ] 6.3 Testar fluxo Retirada reserva: Retirada → dados → não pago → Confirmar → venda reservada sem modal de pagamento
- [ ] 6.4 Testar fluxo Entrega paga: Entrega → dados completos → já pago → pagamento → Finalizar
- [ ] 6.5 Testar fluxo Entrega reserva: Entrega → dados completos → não pago → Confirmar → reserva
- [ ] 6.6 Testar navegação "Voltar" em todas as etapas
- [ ] 6.7 Testar fechar o modal sem finalizar — carrinho deve permanecer intacto
- [x] 6.8 Verificar que não há imports, signals ou métodos órfãos no `SalesComponent` após a limpeza
