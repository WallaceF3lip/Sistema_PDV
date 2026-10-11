import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, fromEvent, merge, timer } from 'rxjs';
import { catchError, exhaustMap, filter } from 'rxjs/operators';
import { SaleService } from '../../core/services/sale.service';
import { ToastService } from '../../core/services/toast.service';
import { PrintService } from '../../core/services/print.service';
import {
  OrderTypeEnum,
  OrderTypeFilter,
  PaymentEntryState,
  PaymentMethodEnum,
  Sale,
  SaleItem,
  SalesBoard,
  SaleStatusEnum,
  formatPhone,
} from '../../core/models';
import { saleLabel } from '../../core/utils/sale-label';
import { PaymentEntryComponent } from '../../shared/components/payment-entry/payment-entry.component';

type BoardGroup = 'PENDING' | 'PAID' | 'CANCELED';
type TypeChip = OrderTypeFilter | 'ALL';

const POLL_INTERVAL_MS = 15000;
const BUSINESS_TZ = 'America/Sao_Paulo';
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** Minutos desde 00:00 de um horário "HH:MM" válido, ou null */
function timeToMinutes(value: string | null | undefined): number | null {
  const m = TIME_RE.exec((value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos desde 00:00 agora, no horário de Brasília */
function nowMinutesInBusinessTz(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** "HH:mm" atual no horário de Brasília */
function nowLabel(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function orderTypeOf(sale: Sale): OrderTypeFilter {
  if (sale.order_type === OrderTypeEnum.PICKUP) return 'PICKUP';
  if (sale.order_type === OrderTypeEnum.DELIVERY) return 'DELIVERY';
  return 'COUNTER';
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentEntryComponent],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class OrdersComponent implements OnInit {
  private readonly saleService = inject(SaleService);
  private readonly toast = inject(ToastService);
  readonly printService = inject(PrintService);
  private readonly destroyRef = inject(DestroyRef);

  readonly saleLabel = saleLabel;
  readonly formatPhone = formatPhone;
  readonly SaleStatusEnum = SaleStatusEnum;

  // ─── Estado ─────────────────────────────────────────────────────────────────
  board = signal<SalesBoard | null>(null);
  /** null = dia de operação atual (servidor) com atualização automática */
  selectedDate = signal<string | null>(null);
  /** Dia de operação atual informado pelo servidor */
  serverToday = signal<string | null>(null);
  typeFilter = signal<TypeChip>('ALL');
  search = signal('');
  mobileTab = signal<BoardGroup>('PENDING');
  showCanceled = signal(false);
  isLoading = signal(false);
  lastUpdated = signal<string | null>(null);
  refreshError = signal<string | null>(null);
  /** Minutos atuais (Brasília), atualizados a cada ciclo — base do "Atrasado" */
  nowMinutes = signal(nowMinutesInBusinessTz());

  // Modal Receber (snapshot da venda; o polling não fecha o modal)
  settleTarget = signal<Sale | null>(null);
  settleState = signal<PaymentEntryState | null>(null);
  settleError = signal<string | null>(null);
  isSettling = signal(false);

  // Modal Cancelar
  cancelTarget = signal<Sale | null>(null);
  cancelError = signal<string | null>(null);
  isCanceling = signal(false);

  // ─── Opções de UI ───────────────────────────────────────────────────────────
  readonly typeChips: { value: TypeChip; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'COUNTER', label: 'Balcão' },
    { value: 'PICKUP', label: 'Retirada' },
    { value: 'DELIVERY', label: 'Entrega' },
  ];

  readonly groups: { value: BoardGroup; label: string }[] = [
    { value: 'PENDING', label: 'A receber' },
    { value: 'PAID', label: 'Pagos' },
    { value: 'CANCELED', label: 'Cancelados' },
  ];

  private readonly typeLabels: Record<OrderTypeFilter, string> = {
    COUNTER: 'Balcão',
    PICKUP: 'Retirada',
    DELIVERY: 'Entrega',
  };

  private readonly methodLabels: Record<PaymentMethodEnum, string> = {
    [PaymentMethodEnum.PIX]: 'PIX',
    [PaymentMethodEnum.CARD]: 'Cartão',
    [PaymentMethodEnum.CASH]: 'Dinheiro',
  };

  // ─── Computed ───────────────────────────────────────────────────────────────
  isToday = computed(() => this.selectedDate() === null);

  /** Data exibida no seletor */
  displayDate = computed(() => this.selectedDate() ?? this.board()?.business_date ?? '');

  orders = computed(() => this.board()?.orders ?? []);

  /** Contagem dos chips (sobre todos os pedidos carregados) */
  typeCounts = computed(() => {
    const counts: Record<TypeChip, number> = { ALL: 0, COUNTER: 0, PICKUP: 0, DELIVERY: 0 };
    for (const sale of this.orders()) {
      counts.ALL++;
      counts[orderTypeOf(sale)]++;
    }
    return counts;
  });

  /** Pedidos após filtro de tipo e busca */
  filteredOrders = computed(() => {
    const type = this.typeFilter();
    const q = this.search().trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return this.orders().filter((sale) => {
      if (type !== 'ALL' && orderTypeOf(sale) !== type) return false;
      if (!q) return true;
      const number = String(sale.daily_number ?? sale.id);
      const name = (sale.customer_name ?? '').toLowerCase();
      const phone = sale.customer_phone ?? '';
      return (
        number.includes(q) ||
        name.includes(q) ||
        phone.toLowerCase().includes(q) ||
        (!!qDigits && phone.replace(/\D/g, '').includes(qDigits))
      );
    });
  });

  pendingOrders = computed(() =>
    this.filteredOrders()
      .filter((s) => s.status === SaleStatusEnum.PENDING)
      .sort((a, b) => {
        const ta = timeToMinutes(a.delivery_time);
        const tb = timeToMinutes(b.delivery_time);
        if (ta !== null && tb !== null && ta !== tb) return ta - tb;
        if (ta === null && tb !== null) return 1;
        if (ta !== null && tb === null) return -1;
        return (a.daily_number ?? Number.MAX_SAFE_INTEGER) - (b.daily_number ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
      }),
  );

  paidOrders = computed(() => this.byNumberDesc(SaleStatusEnum.PAID));
  canceledOrders = computed(() => this.byNumberDesc(SaleStatusEnum.CANCELED));

  groupOrders = computed<Record<BoardGroup, Sale[]>>(() => ({
    PENDING: this.pendingOrders(),
    PAID: this.paidOrders(),
    CANCELED: this.canceledOrders(),
  }));

  // ─── Ciclo de vida ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Polling: a cada 15 s e ao voltar a aba; só com aba visível e no dia atual.
    // exhaustMap evita requisições sobrepostas; erros silenciosos mantêm os dados.
    merge(timer(0, POLL_INTERVAL_MS), fromEvent(document, 'visibilitychange'))
      .pipe(
        filter(() => document.visibilityState === 'visible' && this.selectedDate() === null),
        exhaustMap(() =>
          this.saleService.getBoard(undefined, { silent: true }).pipe(
            catchError(() => {
              this.refreshError.set(nowLabel());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((board) => this.applyBoard(board, true));
  }

  // ─── Carregamento ───────────────────────────────────────────────────────────
  private applyBoard(board: SalesBoard, isCurrentDay: boolean): void {
    // Descarta respostas atrasadas de outra data
    if (isCurrentDay !== (this.selectedDate() === null)) return;
    if (!isCurrentDay && board.business_date !== this.selectedDate()) return;
    if (isCurrentDay) this.serverToday.set(board.business_date);
    this.board.set(board);
    this.lastUpdated.set(nowLabel());
    this.refreshError.set(null);
    this.nowMinutes.set(nowMinutesInBusinessTz());
  }

  /** Carga explícita (botão Atualizar, troca de data, após ações) — com toast em erro */
  refresh(): void {
    const date = this.selectedDate();
    this.isLoading.set(true);
    this.saleService.getBoard(date ?? undefined).subscribe({
      next: (board) => {
        this.isLoading.set(false);
        this.applyBoard(board, date === null);
      },
      error: () => {
        this.isLoading.set(false);
        this.refreshError.set(nowLabel());
      },
    });
  }

  onDateChange(value: string): void {
    if (!value || value === this.serverToday()) {
      this.selectedDate.set(null);
    } else {
      this.selectedDate.set(value);
    }
    this.refresh();
  }

  backToToday(): void {
    this.selectedDate.set(null);
    this.refresh();
  }

  // ─── Helpers de exibição ────────────────────────────────────────────────────
  private byNumberDesc(status: SaleStatusEnum): Sale[] {
    return this.filteredOrders()
      .filter((s) => s.status === status)
      .sort((a, b) => (b.daily_number ?? -1) - (a.daily_number ?? -1) || b.id - a.id);
  }

  groupCount(group: BoardGroup): number {
    return this.groupOrders()[group].length;
  }

  typeLabel(sale: Sale): string {
    return this.typeLabels[orderTypeOf(sale)];
  }

  typeClass(sale: Sale): string {
    return 'type-badge--' + orderTypeOf(sale).toLowerCase();
  }

  isDelivery(sale: Sale): boolean {
    return sale.order_type === OrderTypeEnum.DELIVERY;
  }

  methodLabel(method: PaymentMethodEnum | null | undefined): string {
    return method ? this.methodLabels[method] ?? method : '—';
  }

  paidMethods(sale: Sale): string {
    return sale.payments
      .map((p) => `${this.methodLabel(p.method)} R$ ${Number(p.amount).toFixed(2).replace('.', ',')}`)
      .join(' · ');
  }

  itemLine(item: SaleItem): string {
    const qty = Number(item.quantity);
    const qtyLabel = Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/0+$/, '').replace('.', ',');
    return `${qtyLabel} × ${item.product_name ?? 'Produto #' + item.product_id}`;
  }

  /** Pendente com horário passado (Brasília), somente no dia atual */
  isLate(sale: Sale): boolean {
    if (!this.isToday() || sale.status !== SaleStatusEnum.PENDING) return false;
    const t = timeToMinutes(sale.delivery_time);
    return t !== null && t < this.nowMinutes();
  }

  num(value: number | string | null | undefined): number {
    return Number(value ?? 0);
  }

  // ─── Receber ────────────────────────────────────────────────────────────────
  openSettle(sale: Sale): void {
    this.settleError.set(null);
    this.settleState.set(null);
    this.settleTarget.set(sale);
  }

  closeSettle(): void {
    if (this.isSettling()) return;
    this.settleTarget.set(null);
  }

  confirmSettle(): void {
    const sale = this.settleTarget();
    const state = this.settleState();
    if (!sale || !state?.valid || this.isSettling()) return;
    this.isSettling.set(true);
    this.settleError.set(null);
    this.saleService.settle(sale.id, { payments: state.payments }, { silent: true }).subscribe({
      next: (updated) => {
        this.isSettling.set(false);
        this.settleTarget.set(null);
        this.toast.success(`${saleLabel(updated)} recebido!`);
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.isSettling.set(false);
        this.settleError.set(this.errorMessage(err, 'Erro ao receber pedido.'));
        if (err.status === 400) this.refresh();
      },
    });
  }

  // ─── Cancelar ───────────────────────────────────────────────────────────────
  openCancel(sale: Sale): void {
    this.cancelError.set(null);
    this.cancelTarget.set(sale);
  }

  closeCancel(): void {
    if (this.isCanceling()) return;
    this.cancelTarget.set(null);
  }

  confirmCancel(): void {
    const sale = this.cancelTarget();
    if (!sale || this.isCanceling()) return;
    this.isCanceling.set(true);
    this.cancelError.set(null);
    this.saleService.cancel(sale.id, { silent: true }).subscribe({
      next: (updated) => {
        this.isCanceling.set(false);
        this.cancelTarget.set(null);
        this.toast.success(`${saleLabel(updated)} cancelado.`);
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.isCanceling.set(false);
        this.cancelError.set(this.errorMessage(err, 'Erro ao cancelar pedido.'));
        if (err.status === 400) this.refresh();
      },
    });
  }

  // ─── Reimprimir ─────────────────────────────────────────────────────────────
  reprint(sale: Sale): void {
    this.printService.printOrderTicket(sale, { reprint: true });
  }

  private errorMessage(err: HttpErrorResponse, fallback: string): string {
    const detail = err?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msg = detail
        .map((d: any) => String(d?.msg ?? '').replace(/^Value error, /, ''))
        .filter(Boolean)
        .join(' · ');
      if (msg) return msg;
    }
    if (err?.status === 0) return 'Sem conexão com o servidor';
    return fallback;
  }
}
