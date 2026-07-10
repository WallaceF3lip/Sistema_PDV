import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { CashRegister, CashMovement, CashMovementTypeEnum } from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './cash-register.html',
  styleUrl: './cash-register.scss',
})
export class CashRegisterComponent implements OnInit {
  register: CashRegister | null = null;
  isLoading = signal<boolean>(false);
  openingAmount = 0;
  closingAmount = 0;
  showSangriaModal = false;
  showSuprimentoModal = false;
  showCloseModal = false;
  movementForm = { amount: 0, description: '' };

  movementColumns: TableColumn[] = [
    { key: 'type', label: 'Tipo', width: '150px' },
    { key: 'description', label: 'Descrição' },
    { key: 'created_at', label: 'Horário', width: '120px', align: 'center' },
    { key: 'amount', label: 'Valor', width: '160px', align: 'center' },
  ];

  /** Signal com os movimentos do caixa atual */
  movements = signal<CashMovement[]>([]);

  constructor(
    private cashService: CashRegisterService,
    private toastService: ToastService,
    protected authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadRegister();
  }

  loadRegister(): void {
    this.isLoading.set(true);
    this.cashService.getMyOpen().subscribe({
      next: (reg) => {
        this.register = reg;
        this.movements.set(reg?.movements ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.register = null;
        this.movements.set([]);
        this.isLoading.set(false);
      },
    });
  }

  openRegister(): void {
    this.isLoading.set(true);
    this.cashService.open({ opening_amount: this.openingAmount }).subscribe({
      next: (reg) => {
        this.register = reg;
        this.movements.set(reg.movements ?? []);
        this.toastService.success('Caixa aberto!');
        this.isLoading.set(false);
      },
      error: () => (this.isLoading.set(false)),
    });
  }

  createMovement(type: 'sangria' | 'suprimento'): void {
    if (!this.register) return;

    const obs =
      type === 'sangria'
        ? this.cashService.createSangria(this.register.id, this.movementForm)
        : this.cashService.createSuprimento(this.register.id, this.movementForm);

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

  closeRegister(): void {
    if (!this.register) return;
    this.cashService.close(this.register.id, { closing_amount: this.closingAmount }).subscribe({
      next: (reg) => {
        this.register = reg;
        this.movements.set(reg.movements ?? []);
        this.showCloseModal = false;
        this.toastService.success('Caixa fechado!');
      },
    });
  }

  isInflow(type: string): boolean {
    return ['OPENING', 'SALE', 'SUPRIMENTO'].includes(type);
  }

  movementTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      OPENING:    'Abertura',
      SALE:       'Venda',
      SANGRIA:    'Sangria',
      SUPRIMENTO: 'Suprimento',
      CLOSING:    'Fechamento',
    };
    return labels[type] ?? type;
  }
}
