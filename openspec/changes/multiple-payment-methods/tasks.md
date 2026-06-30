## 1. Modelo de dados e estado do componente

- [ ] 1.1 Definir interface local `PaymentEntry { method: PaymentMethodEnum; amount: number }` em `sales.component.ts`
- [ ] 1.2 Remover sinais `selectedMethod` e `cashReceived`
- [ ] 1.3 Adicionar sinal `paymentEntries = signal<PaymentEntry[]>([])` inicializado como array vazio
- [ ] 1.4 Criar computed `remainingAmount` = `total_amount − soma das entradas` (com tolerância de R$ 0,01)
- [ ] 1.5 Criar computed `changeAmount` = excedente quando alguma entrada for CASH e `remainingAmount < 0`
- [ ] 1.6 Reescrever computed `canFinalize` para verificar: soma cobre total, nenhuma entrada com `amount <= 0`, e processamento inativo

## 2. Métodos do componente

- [ ] 2.1 Reescrever `openPayment()` para inicializar `paymentEntries` com uma única entrada `{ method: PIX, amount: total_amount }`
- [ ] 2.2 Criar método `addPaymentEntry()` que adiciona nova entrada com `amount = remainingAmount()` (mínimo 0) e `method = PIX`
- [ ] 2.3 Criar método `removePaymentEntry(index: number)` que remove a entrada pelo índice
- [ ] 2.4 Criar método `updateEntryMethod(index: number, method: PaymentMethodEnum)` para atualizar o método de uma entrada
- [ ] 2.5 Criar método `updateEntryAmount(index: number, amount: number)` para atualizar o valor de uma entrada (imutável — substitui o item no array)
- [ ] 2.6 Reescrever `finalizeSale()` para mapear `paymentEntries()` filtradas (`amount > 0`) para `PaymentIn[]` e enviar ao backend
- [ ] 2.7 Criar computed `canAddEntry` = `paymentEntries().length < 3 && remainingAmount() > 0`

## 3. Template HTML — modal de pagamento

- [ ] 3.1 Substituir a seção `__methods` do modal pela lista de entradas com `@for (entry of paymentEntries(); track $index)`
- [ ] 3.2 Para cada entrada, renderizar 3 botões tender (`PIX`, `CARD`, `CASH`) que chamam `updateEntryMethod(i, method)`
- [ ] 3.3 Para cada entrada, renderizar campo numérico de valor ligado a `entry.amount` que chama `updateEntryAmount(i, $event)`
- [ ] 3.4 Para cada entrada com índice > 0, renderizar botão "✕" que chama `removePaymentEntry(i)`
- [ ] 3.5 Renderizar badge/indicador "Restante: R$ X,XX" quando `remainingAmount() > 0`
- [ ] 3.6 Renderizar exibição de troco "Troco: R$ X,XX" quando `changeAmount() > 0`
- [ ] 3.7 Renderizar botão "Adicionar forma de pagamento" condicionado a `canAddEntry()`
- [ ] 3.8 Remover o bloco `@if (selectedMethod() === 'CASH')` antigo

## 4. Estilos SCSS

- [ ] 4.1 Adicionar classe `.payment-entries` com layout de coluna e gap entre as entradas
- [ ] 4.2 Adicionar classe `.payment-entry` com grid ou flex: métodos | campo de valor | botão remover
- [ ] 4.3 Adicionar classe `.remaining-badge` para exibir o valor restante em destaque (cor de alerta ou accent)
- [ ] 4.4 Garantir que `.payment-entry` seja responsivo em mobile (≤ 480px): empilhar métodos acima do campo de valor se necessário
- [ ] 4.5 Ajustar `max-height` do `.payment-modal` para acomodar múltiplas entradas sem ultrapassar a viewport (`100dvh − 2rem`)

## 5. Validação e smoke test manual

- [ ] 5.1 Testar venda com 1 método (PIX) — fluxo deve funcionar igual ao anterior
- [ ] 5.2 Testar venda com 2 métodos (ex: R$ 30 PIX + R$ 20 CASH) — verificar payload enviado ao backend
- [ ] 5.3 Testar venda com CASH excedente — verificar exibição correta do troco
- [ ] 5.4 Verificar que o botão "Adicionar" some ao atingir 3 entradas
- [ ] 5.5 Verificar que "Finalizar Venda" permanece desabilitado enquanto soma < total
- [ ] 5.6 Testar no mobile (viewport 375px) — verificar que o modal não estoura e os botões são tocáveis (mínimo 44px)
