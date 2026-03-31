import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { CashRegister, CashMovement } from '../../core/models';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-register.html',
  styleUrl: './cash-register.scss',
})
export class CashRegisterComponent implements OnInit {
  register: CashRegister | null = null;
  isLoading = false;
  openingAmount = 0;
  closingAmount = 0;
  showSangriaModal = false;
  showSuprimentoModal = false;
  showCloseModal = false;
  movementForm = { amount: 0, description: '' };

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  constructor(
    private cashService: CashRegisterService,
    private toastService: ToastService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRegister();
  }

  loadRegister(): void {
    this.isLoading = true;
    this.cashService.getMyOpen().subscribe({
      next: (reg) => {
        this.register = reg;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.register = null;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openRegister(): void {
    this.isLoading = true;
    this.cashService.open({ opening_amount: this.openingAmount }).subscribe({
      next: (reg) => {
        this.register = reg;
        this.toastService.success('Caixa aberto!');
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
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
        this.showCloseModal = false;
        this.toastService.success('Caixa fechado!');
      },
    });
  }

  isInflow(type: string): boolean {
    return ['OPENING', 'SALE', 'SUPRIMENTO'].includes(type);
  }
}
