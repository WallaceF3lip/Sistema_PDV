import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CashMovement,
  CashMovementTypeEnum,
  CashRegister,
  CashRegisterListItem,
  CashRegisterSummary,
} from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';
import { CashSummaryComponent } from './cash-summary/cash-summary.component';

type CashTab = 'current' | 'history';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective, CashSummaryComponent],
  templateUrl: './cash-register.html',
  styleUrl: './cash-register.scss',
})
export class CashRegisterComponent implements OnInit {
  // ── Caixa atual (compartilhado) ──────────────────────────────────────────
  register = signal<CashRegister | null>(null);
  summary = signal<CashRegisterSummary | null>(null);
  /** Signal com os movimentos do caixa atual */
  movements = signal<CashMovement[]>([]);
  isLoading = signal<boolean>(false);

  openingAmount = 0;
  closingAmount = 0;
  showSangriaModal = false;
  showSuprimentoModal = false;
  showCloseModal = false;
  movementForm = { amount: 0, description: '' };

  movementColumns: TableColumn[] = [
    { key: 'type', label: 'Tipo', width: '170px' },
    { key: 'description', label: 'Descrição' },
    { key: 'created_at', label: 'Horário', width: '120px', align: 'center' },
    { key: 'amount', label: 'Valor', width: '160px', align: 'center' },
  ];

  // ── Abas / Histórico (ADMIN) ─────────────────────────────────────────────
  activeTab = signal<CashTab>('current');

  history = signal<CashRegisterListItem[]>([]);
  historyTotal = signal<number>(0);
  historyPage = signal<number>(1);
  readonly historyPageSize = 20;
  historyLoading = signal<boolean>(false);
  historyLoaded = false;
  filterStart = '';
  filterEnd = '';

  selectedSummary = signal<CashRegisterSummary | null>(null);
  summaryLoadingId = signal<number | null>(null);

  historyTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.historyTotal() / this.historyPageSize))
  );

  historyColumns: TableColumn[] = [
    { key: 'opened_at', label: 'Abertura', width: '140px' },
    { key: 'closed_at', label: 'Fechamento', width: '140px' },
    { key: 'opened_by_name', label: 'Aberto por' },
    { key: 'closed_by_name', label: 'Fechado por' },
    { key: 'expected_balance', label: 'Esperado', align: 'right', width: '120px' },
    { key: 'closing_amount', label: 'Contado', align: 'right', width: '120px' },
    { key: 'difference', label: 'Diferença', align: 'right', width: '120px' },
    { key: 'status', label: 'Status', align: 'center', width: '110px' },
    { key: 'actions', label: '', align: 'center', width: '110px' },
  ];

  constructor(
    private cashService: CashRegisterService,
    private toastService: ToastService,
    protected authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadRegister();
  }

  // ── Caixa atual ──────────────────────────────────────────────────────────

  /** Carrega o caixa compartilhado (ou null, sem erro) e o seu resumo. */
  loadRegister(): void {
    this.isLoading.set(true);
    this.cashService.getCurrent().subscribe({
      next: (reg) => {
        this.applyRegister(reg);
        this.isLoading.set(false);
      },
      error: () => {
        this.applyRegister(null);
        this.isLoading.set(false);
      },
    });
  }

  private applyRegister(reg: CashRegister | null): void {
    this.register.set(reg);
    this.movements.set(reg?.movements ?? []);
    this.summary.set(null);
    if (reg) {
      this.loadSummary(reg.id);
    }
  }

  private loadSummary(registerId: number): void {
    this.cashService.getSummary(registerId).subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  openRegister(): void {
    this.isLoading.set(true);
    this.cashService.open({ opening_amount: this.openingAmount }).subscribe({
      next: () => {
        this.toastService.success('Caixa aberto!');
        this.openingAmount = 0;
        this.loadRegister();
      },
      // 409 (outro usuário abriu antes): recarrega para exibir o caixa existente
      error: () => this.loadRegister(),
    });
  }

  createMovement(type: 'sangria' | 'suprimento'): void {
    const reg = this.register();
    if (!reg) return;

    const obs =
      type === 'sangria'
        ? this.cashService.createSangria(reg.id, this.movementForm)
        : this.cashService.createSuprimento(reg.id, this.movementForm);

    obs.subscribe({
      next: () => {
        this.toastService.success(type === 'sangria' ? 'Sangria registrada!' : 'Suprimento registrado!');
        this.showSangriaModal = false;
        this.showSuprimentoModal = false;
        this.movementForm = { amount: 0, description: '' };
        this.loadRegister();
      },
    });
  }

  openCloseModal(): void {
    const reg = this.register();
    if (reg) this.loadSummary(reg.id); // esperado atualizado ao abrir o modal
    this.closingAmount = 0;
    this.showCloseModal = true;
  }

  /** Dinheiro esperado na gaveta (resumo, com fallback para o saldo do caixa). */
  expectedCash(): number {
    const s = this.summary();
    if (s) return Number(s.expected_cash);
    return Number(this.register()?.current_balance ?? 0);
  }

  /** Diferença ao vivo: contagem digitada − esperado. */
  closeDifference(): number {
    return Number(this.closingAmount || 0) - this.expectedCash();
  }

  closeRegister(): void {
    const reg = this.register();
    if (!reg) return;
    this.cashService.close(reg.id, { closing_amount: this.closingAmount }).subscribe({
      next: (closed) => {
        this.showCloseModal = false;
        this.toastService.success('Caixa fechado!');
        // Mantém o caixa fechado em tela com o resumo final (contagem/diferença)
        this.applyRegister(closed);
        this.historyLoaded = false;
      },
    });
  }

  // ── Movimentos ───────────────────────────────────────────────────────────

  isInflow(type: string): boolean {
    return [
      CashMovementTypeEnum.OPENING,
      CashMovementTypeEnum.SALE,
      CashMovementTypeEnum.SUPRIMENTO,
    ].includes(type as CashMovementTypeEnum);
  }

  /** Fechamento é só o registro da contagem — sem sinal de entrada/saída. */
  isNeutral(type: string): boolean {
    return type === CashMovementTypeEnum.CLOSING;
  }

  methodLabel(method: string | null | undefined): string {
    const labels: Record<string, string> = { CASH: 'Dinheiro', CARD: 'Cartão', PIX: 'PIX' };
    return method ? labels[method] ?? method : '';
  }

  movementTypeLabel(row: CashMovement): string {
    if (row.type === CashMovementTypeEnum.SALE) {
      return row.payment_method ? `Venda (${this.methodLabel(row.payment_method)})` : 'Venda';
    }
    if (row.type === CashMovementTypeEnum.SALE_CANCEL) {
      return row.payment_method ? `Estorno (${this.methodLabel(row.payment_method)})` : 'Estorno';
    }
    const labels: Record<string, string> = {
      OPENING:    'Abertura',
      SANGRIA:    'Sangria',
      SUPRIMENTO: 'Suprimento',
      CLOSING:    'Fechamento',
    };
    return labels[row.type] ?? row.type;
  }

  // ── Abas / Histórico ─────────────────────────────────────────────────────

  selectTab(tab: CashTab): void {
    this.activeTab.set(tab);
    if (tab === 'history' && !this.historyLoaded) {
      this.searchHistory();
    }
  }

  searchHistory(): void {
    this.historyPage.set(1);
    this.loadHistory();
  }

  loadHistory(): void {
    if (!this.authService.isAdmin()) return;
    this.historyLoading.set(true);
    this.cashService
      .list({
        start_date: this.filterStart || undefined,
        end_date: this.filterEnd || undefined,
        page: this.historyPage(),
        page_size: this.historyPageSize,
      })
      .subscribe({
        next: (page) => {
          this.history.set(page.items);
          this.historyTotal.set(page.total);
          this.historyLoaded = true;
          this.historyLoading.set(false);
        },
        error: () => this.historyLoading.set(false),
      });
  }

  clearHistoryFilters(): void {
    this.filterStart = '';
    this.filterEnd = '';
    this.searchHistory();
  }

  prevHistoryPage(): void {
    if (this.historyPage() <= 1) return;
    this.historyPage.update((p) => p - 1);
    this.loadHistory();
  }

  nextHistoryPage(): void {
    if (this.historyPage() >= this.historyTotalPages()) return;
    this.historyPage.update((p) => p + 1);
    this.loadHistory();
  }

  viewSummary(item: CashRegisterListItem): void {
    this.summaryLoadingId.set(item.id);
    this.cashService.getSummary(item.id).subscribe({
      next: (s) => {
        this.selectedSummary.set(s);
        this.summaryLoadingId.set(null);
      },
      error: () => this.summaryLoadingId.set(null),
    });
  }

  closeSummaryModal(): void {
    this.selectedSummary.set(null);
  }

  toNumber(value: number | string | null | undefined): number {
    return Number(value ?? 0);
  }
}
