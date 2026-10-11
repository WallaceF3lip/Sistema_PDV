## Why

A cozinha e o motoboy precisam de uma comanda em papel com itens, cliente, observações e dados de entrega. Hoje o sistema não tem nenhuma impressão: o operador copia o pedido à mão ou lê na tela, o que gera erros no pico de fim de semana. A loja usa impressora térmica de 80 mm ligada ao computador do caixa, então a impressão pelo navegador (sem driver/serviço extra) resolve o problema já, e o quadro `/orders` (change `daily-orders-board`) já reserva o botão "Reimprimir" esperando por este serviço.

## What Changes

- Implementação real do `PrintService` (`core/services/print.service.ts`), que substitui o stub criado por `daily-orders-board` mantendo a assinatura `canPrint(): boolean` e `printOrderTicket(sale: Sale, options?: PrintTicketOptions): void`. `canPrint()` passa a retornar `true` quando `window.print` existe, o que exibe o botão "Reimprimir" no quadro `/orders`.
- Novo `OrderTicketComponent` (`shared/components/order-ticket`): a comanda formatada para bobina de 80 mm (área útil de 72 mm, fonte monoespaçada de ~42 colunas). Contém o nome do estabelecimento, "Pedido #N" (`saleLabel`), data/hora, tipo (Balcão/Retirada/Entrega), cliente, telefone, endereço + zona, horário de entrega/retirada, itens (qtd × nome, unitário, subtotal), subtotal dos itens, taxa de entrega, total, pagamentos (com troco quando informado) ou "A RECEBER: <método>", observações e rodapé.
- Novo `PrintRootComponent` montado em `AppComponent`, fora do layout e do `router-outlet`. Regras globais em `styles.scss`: `@media print` esconde o app e mostra só a área de impressão; `@page { size: 80mm auto; margin: 0 }`.
- Fluxo de impressão: renderiza a comanda, espera o render (`afterNextRender` + `setTimeout`), chama `window.print()` e limpa no `afterprint`. Impressões seguidas entram em fila e não se sobrepõem.
- Checkout (`sale-checkout-modal`): checkbox "Imprimir comanda" na etapa de pagamento e na de detalhes (reserva). Vem marcado por padrão e a escolha fica salva em `localStorage`. Quando marcado, a resposta de `finalize` (`SaleOut` completo) é impressa logo após a finalização, com o troco calculado no checkout.
- Vias: configuração `ticket.copies` (1 ou 2, padrão 1) em `environment*.ts`. Com 2 vias, a comanda sai duas vezes no mesmo trabalho de impressão, com rótulos "VIA COZINHA" e "VIA CLIENTE" e corte de página entre elas. A reimpressão sai sempre em 1 via.
- Identificação da loja: `environment*.ts` ganha `establishment { name, phone?, footer? }`, usado no cabeçalho e no rodapé da comanda.
- Histórico de vendas (`/sales-history`): o botão placeholder "Editar" dá lugar a "Reimprimir" (para vendas `PENDING`/`PAID`).
- Sem mudanças no backend: `POST /sales/{id}/finalize`, `GET /sales`, `GET /sales/board` já devolvem `SaleOut` com `daily_number`, `product_name`, `items_total`, `delivery_fee`, `delivery_zone_name` e `payments` (pré-requisitos).

## Capabilities

### New Capabilities
- `order-ticket-printing`: comanda de pedido para impressora térmica de 80 mm pelo navegador. Cobre o conteúdo e o layout da comanda, o serviço de impressão (render, `window.print`, limpeza, fila), a impressão automática ao finalizar com preferência lembrada, as vias, a reimpressão no quadro e no histórico, e a configuração do estabelecimento.

### Modified Capabilities
- `sales-history-view`: o botão placeholder "Editar" de cada linha é removido e substituído pela ação "Reimprimir" (comanda) para vendas `PENDING` e `PAID`.

## Impact

- **Pré-requisitos**: changes `customer-registry`, `delivery-zones-and-fee`, `single-cash-register` e `daily-orders-board` implementadas. São usados `Sale.daily_number`, `business_date`, `paid_at`, `SaleItem.product_name`, `items_total`, `delivery_fee`, `delivery_zone_name`, o helper `saleLabel()` e o stub `PrintService`.
- **Frontend**: `core/services/print.service.ts` (implementação), novo `core/utils/ticket-format.ts`, `shared/components/order-ticket/*`, `shared/components/print-root/*`, `app.component.ts`, `styles.scss` (bloco `@media print` / `@page`), `environments/environment.ts` e `environment.development.ts` (`establishment`, `ticket`), `pages/sales/sale-checkout-modal/*` (checkbox e impressão pós-finalização), `pages/sales-history/*` (ação Reimprimir). O quadro `pages/orders` não muda: o botão aparece porque `canPrint()` passa a ser `true`.
- **Backend / banco**: nenhuma alteração.
- **Operação**: recomenda-se configurar a impressora térmica como padrão do Chrome com margens "Nenhuma". Para imprimir sem diálogo, o Chrome pode ser aberto com `--kiosk-printing` (nota operacional no design).
