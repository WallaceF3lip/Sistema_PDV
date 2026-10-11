## Context

Ver proposal.md (Why). Estado atual verificado no código:

- Não existe nenhum código de impressão no frontend. `pdv_View/src/index.html` só tem `<app-root>`. `app.component.ts` renderiza `<router-outlet />` + `<app-toast />`. `styles.scss` não tem regras `@media print` nem `@page`.
- `pages/sales/sale-checkout-modal/sale-checkout-modal.component.ts`: `finalizeSale()` e `_finalizeReservation()` chamam `saleService.finalize(id, { payments })`, que devolve `Observable<Sale>`. Hoje a resposta é ignorada (`next: () => …`), o modal emite `completed` (`EventEmitter<void>`) e `pages/sales/sales.component.ts#onCheckoutCompleted` só limpa `currentSale` e fecha o modal, que é destruído.
- `pdv_API/app/routers/sales.py`: `POST /sales/{id}/finalize` tem `response_model=SaleOut` e `SaleService.finalize_sale` devolve a venda após `db.refresh(sale)`. Os relacionamentos (`items`, `items.product`, `payments`, `delivery_zone`) carregam sob demanda durante a serialização, com a sessão de `get_db` ainda aberta. Com os pré-requisitos, `SaleOut` já tem `daily_number`, `business_date`, `paid_at`, `items_total`, `delivery_fee`, `delivery_zone_name` e `items[].product_name`. **Conclusão: nenhuma mudança de backend é necessária.**
- `daily-orders-board` cria `core/services/print.service.ts` como stub (`canPrint() → false`, `printOrderTicket(sale)` no-op), `core/utils/sale-label.ts` (`saleLabel`) e o componente `app-payment-entry` (emite `PaymentEntryState { payments, valid, remaining, change }`, com `payments` já descontando o troco). Os cartões do quadro mostram "Reimprimir" só se `printService.canPrint()`.
- `pages/sales-history`: a coluna `actions` (90px) tem o botão placeholder "Editar" (`onEdit` vazio).
- Configuração do frontend: `environments/environment.ts` (prod) e `environment.development.ts` têm só `production` e `apiUrl`.
- Quantidades são `Numeric(10,3)` (produtos `UN`/`KG`/`LT`).

## Goals / Non-Goals

**Goals:**
- Comanda legível em bobina de 80 mm, impressa pelo diálogo nativo do Chrome, sem dependências novas.
- Implementar o contrato `PrintService` sem quebrar `daily-orders-board`.
- Impressão automática ao finalizar, que o operador pode desligar, e reimpressão no quadro e no histórico.

**Non-Goals:**
- Impressão silenciosa garantida, ESC/POS, QZ Tray, agente local ou WebUSB/Web Serial.
- Corte de papel e gaveta de dinheiro (dependem do driver da impressora).
- Configuração do estabelecimento persistida no backend ou editável pela interface (fica para uma change futura de "Configurações").
- Cupom fiscal (NFC-e/SAT). A comanda deve dizer que não é documento fiscal.
- Comandas por setor (separar itens de cozinha e de bar).

## Decisions

### 1. Impressão no próprio documento (print root + `@media print`) em vez de janela/iframe
**Decisão**: novo `shared/components/print-root/print-root.component.ts` (`app-print-root`, standalone), adicionado em `AppComponent` depois de `<app-toast />`, fora do `router-outlet` e do `MainLayout`. Ele renderiza `@for (copy of printService.job()?.copies)` → `<app-order-ticket [sale] [copyLabel] [extras]>`. Em `styles.scss`:
```scss
.print-root { display: none; }
@media print {
  @page { size: 80mm auto; margin: 0; }
  html, body { width: 80mm; background: #fff !important; min-height: 0 !important; }
  body.is-printing-ticket app-root > :not(app-print-root) { display: none !important; }
  body.is-printing-ticket .print-root { display: block; }
}
```
O `PrintService` adiciona/remove a classe `is-printing-ticket` no `body` (via `DOCUMENT`). Fora de uma impressão de comanda, `Ctrl+P` continua imprimindo a tela.
**Rationale**: não depende de pop-up (bloqueadores e `window.open` em kiosk), reaproveita os pipes e o Angular e não exige copiar CSS para outro documento. Esconder pelo seletor `app-root > :not(app-print-root)` cobre layout, modais (que estão dentro do layout) e toasts de uma vez.
**Alternativa**: `window.open` com HTML montado à mão. Rejeitada: bloqueador de pop-up e dois documentos para manter. `<iframe>` oculto com `contentWindow.print()`: funciona, mas exige serializar o HTML/CSS do ticket e o comportamento de `afterprint` em iframe varia. Fica como plano B se o print root apresentar problemas.

### 2. `@page { size: 80mm auto; margin: 0 }` e área útil de 72 mm
**Decisão**: `.ticket { width: 72mm; margin: 0 auto; padding: 2mm 0 6mm; font: 12px/1.3 'Courier New', ui-monospace, monospace; color: #000; }`. Isso dá ~40–42 colunas a 12px, o equivalente legível da "Fonte A" de 48 colunas do ESC/POS: 48 colunas exigiriam ~9.5px, ilegível em térmica de 203 dpi. O layout usa flex (`.row { display:flex; justify-content:space-between }`, valor com `white-space:nowrap`, descrição com `overflow-wrap:anywhere`), não strings com espaços. Separadores são `border-top: 1px dashed #000`. O título "Pedido #N" usa 20px bold e o TOTAL 16px bold. Nada de cores, sombras ou fontes web: o `@media print` força `font-family` monoespaçada do sistema.
**Rationale**: o `@page` com altura `auto` evita a folha A4 com 90% em branco. Chrome respeita `size`. Margem 0 remove cabeçalho/rodapé do navegador (data/URL), e os 4 mm de cada lado ficam por conta da largura 72 mm, porque as térmicas não imprimem nas bordas.
**Alternativa**: gerar texto de 48 colunas com `padEnd` em um `<pre>`. Rejeitada: frágil com acentos e fontes proporcionais de fallback, e sem ganho no driver Windows.

### 3. `PrintService` (implementação do contrato)
**Decisão**: `core/services/print.service.ts`, `@Injectable({ providedIn: 'root' })`:
- `canPrint(): boolean` → `typeof window !== 'undefined' && typeof window.print === 'function'`.
- `printOrderTicket(sale: Sale, options?: PrintTicketOptions): void`, com `PrintTicketOptions { copies?: 1 | 2; reprint?: boolean; cashReceived?: number; change?: number }`. O parâmetro opcional não quebra o contrato do stub. Monta um `PrintJob { sale, copies: { label: string | null }[], extras }`: com `reprint` é 1 via "REIMPRESSÃO"; senão `copies ?? environment.ticket.copies`; 2 vias → `['VIA COZINHA', 'VIA CLIENTE']`; 1 via → `[null]`. Coloca o job numa fila (`queue: PrintJob[]`) e chama `processNext()` se estiver ocioso.
- `job = signal<PrintJob | null>(null)` (lido por `PrintRootComponent`).
- `processNext()`: `job.set(next)`, adiciona `is-printing-ticket` ao body e agenda `afterNextRender(() => setTimeout(() => this.doPrint(), 50), { injector })`. O `setTimeout` deixa o layout/fonte assentarem antes do snapshot de impressão. `doPrint()` registra `window.addEventListener('afterprint', finish, { once: true })` e chama `window.print()` dentro de `try/catch`. `finish()` remove a classe, faz `job.set(null)` e processa o próximo da fila. Fallback: como `window.print()` é bloqueante no Chrome desktop, `finish()` também é chamado logo após o retorno de `print()`. Uma flag evita o duplo `finish` e um timeout de segurança de 60 s libera a fila se o `afterprint` nunca vier (alguns navegadores mobile).
- Erros: `catch` → `toastService.error('Não foi possível imprimir a comanda.')` + `finish()`. Nunca relança.
**Rationale**: um único ponto de impressão, uma fila que evita diálogos sobrepostos ou comandas misturadas, e o render garantido antes do `print()`.
**Alternativa**: `window.print()` síncrono logo após `job.set()`. Rejeitada: imprime a área vazia porque a detecção de mudanças ainda não rodou.

### 4. `OrderTicketComponent` e formatação
**Decisão**: `shared/components/order-ticket/order-ticket.component.ts|html|scss` (`app-order-ticket`, standalone, `ChangeDetectionStrategy.OnPush`). Inputs: `sale = input.required<Sale>()`, `copyLabel = input<string | null>(null)`, `extras = input<{ cashReceived?: number; change?: number } | null>(null)`. Os helpers puros ficam em `core/utils/ticket-format.ts` (testáveis):
- `formatMoney(n)` → `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- `formatQty(q)` → inteiro sem casas, senão até 3 casas com vírgula.
- `orderTypeLabel(t)` → `BALCÃO`/`RETIRADA`/`ENTREGA`.
- `paymentMethodLabel(m)` → Dinheiro/Cartão/PIX.
- `ticketDateTime(sale)` → `closed_at ?? opened_at` em `dd/MM/yyyy HH:mm`, no fuso do navegador (a loja opera em `America/Sao_Paulo`).
Ordem dos blocos conforme a spec. Cabeçalho: `environment.establishment.name ?? 'PDV'`, telefone e o `copyLabel` em caixa invertida (borda). Identificação: `saleLabel(sale)` em destaque + data/hora + tipo. Itens em duas linhas: `"{qty} x {product_name ?? 'Produto #'+id}"` / `"  {unit}    {subtotal}"`. Pagamento: `PAID` → `payments`, e se `extras.change > 0`, "Recebido" e "Troco". `PENDING` → "A RECEBER: {método}" + total (`delivery_payment_method`). Observações em `white-space: pre-wrap` com borda. Rodapé: `environment.establishment.footer ?? 'Obrigado pela preferência!'`, "Impresso em dd/MM HH:mm" e "Não é documento fiscal".
**Rationale**: as funções puras são reutilizáveis (por exemplo, no cartão do quadro) e unit-testáveis sem DOM.

### 5. Origem do nome do estabelecimento: `environment`
**Decisão**: `environment.ts` / `environment.development.ts` ganham:
```ts
establishment: { name: 'Nome da Loja', phone: '', footer: 'Obrigado pela preferência!' },
ticket: { copies: 1 as 1 | 2 },
```
**Rationale**: não existe tabela de configurações no backend e o brief exige nenhuma mudança de backend. Trocar o nome é uma edição de uma linha + deploy, e acontece raramente.
**Alternativa**: endpoint `/settings` com tabela própria. Adiada para uma change de configurações; a comanda passaria a ler de um `SettingsService` sem mudar a spec. `localStorage`: rejeitado, porque cada computador teria um nome diferente.

### 6. Impressão automática no checkout com preferência lembrada
**Decisão**: no `SaleCheckoutModalComponent`, `printTicket = signal(readPref())`, com `readPref()` = `localStorage.getItem('pdv.printTicketOnFinalize') !== 'false'` (padrão `true`; `try/catch` → `true`). Ao mudar: `localStorage.setItem(...)`. Um checkbox `.ticket-toggle` "🖨 Imprimir comanda" aparece no rodapé da etapa PAYMENT e da etapa DETAILS (quando "Já pago?" está desmarcado, porque é ali que a reserva finaliza). Só aparece se `printService.canPrint()`. Em `finalizeSale()`, `next: (finalized: Sale) => { toast; isProcessing false; if (printTicket()) printService.printOrderTicket(finalized, { cashReceived, change }); completed.emit(); }`, em que `change` = `PaymentEntryState.change` e `cashReceived` = soma das entradas CASH + troco (só se `change > 0`). `_finalizeReservation()` faz o mesmo sem extras. O `completed` continua `EventEmitter<void>`, então `sales.component` não muda. O serviço é singleton em root e o job vive no `PrintRootComponent`, então destruir o modal não interrompe a impressão.
**Rationale**: imprimir é o caso de uso padrão. Lembrar a escolha por estação de trabalho atende o caixa que não tem impressora. Usar a resposta do `finalize` dá o `daily_number` recém-atribuído sem um GET extra.
**Alternativa**: perguntar "Imprimir?" após finalizar. Rejeitada: um clique a mais no pico. Configuração global no backend: desnecessária agora.

### 7. Vias: configurável, padrão 1, mesmo trabalho de impressão
**Decisão**: `environment.ticket.copies` (1|2). Com 2, o print root renderiza duas `.ticket` separadas por `break-after: page` (o driver térmico normalmente corta entre páginas), com "VIA COZINHA" e "VIA CLIENTE". A reimpressão força 1 via "REIMPRESSÃO".
**Rationale**: um diálogo só (2 diálogos irritam no pico). O padrão 1 economiza papel nas lojas sem separação cozinha/balcão. O rótulo de reimpressão evita confusão com pedidos duplicados na cozinha.
**Alternativa**: definir as vias pelo campo "Cópias" do diálogo do Chrome. Rejeitada: não permite rótulos diferentes e é esquecido. Seletor de vias por venda: excesso de UI.

### 8. Reimpressão no quadro e no histórico
**Decisão**: o quadro `/orders` não muda, porque `canPrint()` agora retorna `true` e o botão já chama `printOrderTicket(sale)`. A única exigência é que ele passe `{ reprint: true }`: se a implementação do quadro chamar sem opções, esta change ajusta a chamada em `pages/orders` (tarefa). Histórico: em `pages/sales-history`, o template `dtCell="actions"` troca "Editar" por `@if (canReprint(row)) <button class="btn btn-ghost" (click)="reprint(row)">🖨 Reimprimir</button>`, com `canReprint` = `printService.canPrint() && (status === PENDING || status === PAID)`. Remove `onEdit` e ajusta a largura da coluna para `120px`. Os dados vêm de `GET /sales`, que já traz `product_name` e os campos de entrega.
**Rationale**: o "Editar" nunca funcionou. Usar os dados já carregados reflete o estado atual (por exemplo, quitado) sem uma requisição extra.

### 9. Notas operacionais (impressora/navegador)
- Instalar o driver da térmica (Epson TM-T20, Elgin i9, Bematech MP-4200 etc.) com papel 80 mm × "rolo"/"receipt" e defini-la como **impressora padrão** do Windows. No Chrome, na primeira impressão: destino = térmica, Margens = Nenhuma, desmarcar "Cabeçalhos e rodapés". O Chrome memoriza o destino.
- **Impressão sem diálogo**: atalho do Chrome com `chrome.exe --kiosk-printing --app=https://<url-do-pdv>`. O `print()` vai direto para a impressora padrão, sem diálogo. Com `--kiosk-printing` o `afterprint` ainda dispara e a fila continua funcionando. Recomendado para o caixa principal.
- Firefox/Safari funcionam pelo diálogo, mas podem ignorar `@page size`; é preciso escolher o papel 80 mm no diálogo. O navegador suportado é o Chrome/Edge.
- Bloqueador de pop-up não interfere (não abrimos janelas).

## Risks / Trade-offs

- [Driver ignora `size: 80mm auto` e usa A4] → Selecionar o papel "80mm x Receipt/Roll" nas preferências do driver. O conteúdo tem 72 mm fixos, então mesmo em A4 sai legível no canto.
- [Sem `--kiosk-printing`, o diálogo abre a cada venda e custa um clique (Enter)] → Documentado. A opção "Imprimir comanda" pode ser desligada. O kiosk é recomendado.
- [Fonte monoespaçada diferente por máquina altera a contagem de colunas] → O layout é flex, com quebra de linha, e não depende do número de colunas.
- [O `afterprint` não dispara em alguns navegadores e a fila trava] → `finish()` também roda após o retorno de `print()`, com timeout de segurança de 60 s.
- [O `@page` global afeta qualquer outra impressão do app] → Hoje não há outra impressão. Se surgir, mover o `@page` para uma página nomeada (`page: ticket`) ou para um iframe (decisão 1, alternativa).
- [Troco não é persistido no backend] → Recebido/troco só aparecem na impressão feita no checkout. A reimpressão mostra só os pagamentos (aceito; o troco não tem valor fiscal).
- [Com o `isPaid` desmarcado, a reserva finaliza no `confirmDetails`] → O checkbox também fica na etapa DETAILS para cobrir esse caminho.

## Migration Plan

1. Implantar depois das changes pré-requisito (o backend não muda; nenhum script SQL).
2. Ajustar `environment.ts` com o nome real da loja antes do build de produção.
3. Configurar a impressora/Chrome conforme a decisão 9 em cada caixa.
4. Rollback: reverter o frontend. O stub do `daily-orders-board` volta a esconder "Reimprimir". A preferência `pdv.printTicketOnFinalize` em `localStorage` fica inofensiva.

## Open Questions

- Logotipo no cabeçalho (imagem monocromática) pode ser adicionado depois via `environment.establishment.logoUrl`, sem mudar a spec.
