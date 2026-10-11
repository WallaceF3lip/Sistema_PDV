## 1. Pré-requisitos e verificação

- [x] 1.1 Confirmar que `customer-registry`, `delivery-zones-and-fee`, `single-cash-register` e `daily-orders-board` estão implementadas: `Sale` (frontend) tem `daily_number`, `items_total`, `delivery_fee`, `delivery_zone_name`, `items[].product_name`; existem `core/utils/sale-label.ts` e `core/services/print.service.ts` (stub)
- [ ] 1.2 Verificar com o backend rodando que a resposta de `POST /sales/{id}/finalize` traz `daily_number`, `items[].product_name`, `items_total`, `delivery_fee`, `delivery_zone_name` e `payments` (nenhuma mudança de backend esperada; se faltar algum campo, registrar no PR e corrigir na change pré-requisito)

## 2. Configuração

- [x] 2.1 Adicionar `establishment: { name, phone, footer }` e `ticket: { copies: 1 }` em `pdv_View/src/environments/environment.ts` e `environment.development.ts`

## 3. Formatação e componente da comanda

- [x] 3.1 Criar `core/utils/ticket-format.ts` com `formatMoney`, `formatQty`, `orderTypeLabel`, `paymentMethodLabel`, `ticketDateTime`
- [x] 3.2 Criar `ticket-format.spec.ts` com testes de quantidade inteira/fracionada, moeda `R$ 1.234,56`, rótulos de tipo e método e data com `closed_at` nulo
- [x] 3.3 Criar `shared/components/order-ticket/order-ticket.component.ts|html|scss` (`app-order-ticket`, OnPush, inputs `sale`, `copyLabel`, `extras`) com os blocos na ordem da spec: cabeçalho, identificação (`saleLabel`), cliente/entrega, itens, totais, pagamento ou "A RECEBER: <método>", observações e rodapé
- [x] 3.4 Estilos da comanda: largura 72 mm, fonte monoespaçada 12px, linhas flex com valores `nowrap`, quebra de nomes longos, separadores tracejados, destaque para Pedido #, TOTAL, A RECEBER e observações, `break-after: page` entre vias, somente preto e branco

## 4. Serviço e área de impressão

- [x] 4.1 Substituir o stub de `core/services/print.service.ts`: `canPrint()` real, `printOrderTicket(sale, options?)` com `PrintTicketOptions`, montagem das vias (environment / reimpressão), fila, `job` signal
- [x] 4.2 Implementar o ciclo `processNext` → classe `is-printing-ticket` no body → `afterNextRender` + `setTimeout` → `window.print()` → `finish` (por `afterprint`, pelo retorno de `print()` ou pelo timeout de 60 s, sem duplicar) → próximo da fila; erro vira toast e nunca é relançado
- [x] 4.3 Criar `shared/components/print-root/print-root.component.ts` (`app-print-root`, classe `.print-root`) renderizando as vias do `job()` com `app-order-ticket`
- [x] 4.4 Adicionar `<app-print-root />` em `app.component.ts` (imports + template, depois de `<app-toast />`)
- [x] 4.5 Adicionar o bloco de impressão global em `src/styles.scss`: `.print-root { display:none }` e `@media print` com `@page { size: 80mm auto; margin: 0 }`, `html, body` 80 mm e fundo branco, e regras de `body.is-printing-ticket` que escondem `app-root > :not(app-print-root)` e mostram `.print-root`
- [x] 4.6 Criar `print.service.spec.ts`: vias (1, 2, reimpressão), fila sequencial com `window.print` mockado, limpeza da classe/job após `afterprint`, erro em `print()` não propaga

## 5. Checkout: impressão ao finalizar

- [x] 5.1 Em `pages/sales/sale-checkout-modal/sale-checkout-modal.component.ts`: injetar `PrintService`; `printTicket` signal lido de `localStorage['pdv.printTicketOnFinalize']` (padrão true, com try/catch) e persistido ao alterar
- [x] 5.2 Em `sale-checkout-modal.html`: checkbox "Imprimir comanda" na etapa PAYMENT e na etapa DETAILS quando "Já pago?" está desmarcado, visível só se `canPrint()`; estilo em `sale-checkout-modal.scss`
- [x] 5.3 Em `finalizeSale()`: usar o `Sale` retornado e, se `printTicket()`, chamar `printOrderTicket(finalized, { cashReceived, change })` a partir do `PaymentEntryState` (só com troco > 0) antes de `completed.emit()`
- [x] 5.4 Em `_finalizeReservation()`: usar o `Sale` retornado e imprimir (sem extras) se `printTicket()`; nos dois fluxos, nada é impresso em caso de erro

## 6. Reimpressão

- [x] 6.1 Em `pages/orders` (quadro): garantir que o botão "Reimprimir" chama `printOrderTicket(sale, { reprint: true })` e aparece só para PENDING/PAID
- [x] 6.2 Em `pages/sales-history/sales-history.component.ts`: injetar `PrintService`, remover `onEdit`, adicionar `canReprint(sale)` (PENDING/PAID e `canPrint()`) e `reprint(sale)` (`{ reprint: true }`), coluna `actions` com 120px
- [x] 6.3 Em `pages/sales-history/sales-history.html`: trocar o botão "Editar" por `@if (canReprint(row))` "🖨 Reimprimir"

## 7. Verificação

- [ ] 7.1 `ng build` sem erros e `ng test` passando
- [ ] 7.2 Teste manual (Chrome, pré-visualização): venda Balcão paga em dinheiro com troco → comanda com Recebido/Troco, só a comanda no preview, página com 80 mm sem margens
- [ ] 7.3 Teste manual: Entrega pendente com zona, taxa e observação de várias linhas → "Pedido #N", endereço + zona, "Entrega: HH:MM", taxa, TOTAL e "A RECEBER: <método>"
- [ ] 7.4 Teste manual: Retirada com "Já pago?" desmarcado e impressão ligada → comanda impressa na reserva
- [ ] 7.5 Teste manual: desmarcar "Imprimir comanda", finalizar, abrir nova venda → nada impresso e opção ainda desmarcada; recarregar a página → continua desmarcada
- [ ] 7.6 Teste manual: cancelar o diálogo → nenhum erro, tela normal; `Ctrl+P` fora da impressão de comanda imprime a tela normalmente
- [ ] 7.7 Teste manual: `ticket.copies = 2` → um diálogo com "VIA COZINHA" e "VIA CLIENTE" em páginas separadas; reimpressão → uma via "REIMPRESSÃO"
- [ ] 7.8 Teste manual: quadro `/orders` exibe "Reimprimir" em pendentes/pagos (não em cancelados); quitar um pendente e reimprimir → mostra os pagamentos; histórico reimprime vendas PAID/PENDING e não exibe o botão em CANCELED
- [ ] 7.9 Teste manual: clicar "Reimprimir" em dois pedidos seguidos → diálogos em sequência, sem misturar comandas
- [ ] 7.10 Teste em impressora térmica real (se disponível), com e sem `--kiosk-printing`: largura, quebra de nomes longos, corte entre vias
