import { Component, OnInit } from '@angular/core';
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
  template: `
    <div class="cash-register">
      <div class="cash-register__header">
        <div>
          <h2 class="headline-lg">Caixa</h2>
          <p class="body-md text-muted">Gerenciar sessão de caixa</p>
        </div>
      </div>

      @if (!register) {
        <!-- No open register -->
        <div class="cash-register__open card animate-scale-in">
          <div class="cash-register__open-content">
            <span class="cash-register__icon">◈</span>
            <h3 class="headline-md">Nenhum caixa aberto</h3>
            <p class="body-md text-muted">Abra uma sessão de caixa para começar</p>

            <form class="open-form" (ngSubmit)="openRegister()">
              <div class="form-group">
                <label class="label-sm text-muted">FUNDO DE TROCO (R$)</label>
                <input class="input-field" type="number" step="0.01" [(ngModel)]="openingAmount" name="opening" required />
              </div>
              <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="isLoading">
                Abrir Caixa
              </button>
            </form>
          </div>
        </div>
      } @else {
        <!-- Open register -->
        <div class="cash-register__content">
          <div class="cash-register__status card animate-slide-up">
            <div class="status-header">
              <span class="badge" [class.badge--accent]="register.status === 'OPEN'" [class.badge--muted]="register.status === 'CLOSED'">
                {{ register.status === 'OPEN' ? 'ABERTO' : 'FECHADO' }}
              </span>
              <span class="body-sm text-muted">Caixa #{{ register.id }}</span>
            </div>

            <div class="status-balance">
              <span class="label-sm text-muted">SALDO ATUAL</span>
              <span class="display-md">R$ {{ register.current_balance | number:'1.2-2' }}</span>
            </div>

            <div class="status-details">
              <div class="status-detail">
                <span class="body-sm text-muted">Abertura</span>
                <span class="title-md">R$ {{ register.opening_amount | number:'1.2-2' }}</span>
              </div>
              @if (register.closing_amount !== null) {
                <div class="status-detail">
                  <span class="body-sm text-muted">Fechamento</span>
                  <span class="title-md">R$ {{ register.closing_amount | number:'1.2-2' }}</span>
                </div>
                <div class="status-detail">
                  <span class="body-sm text-muted">Diferença</span>
                  <span class="title-md" [class.text-accent]="register.difference! >= 0" [class.text-error]="register.difference! < 0">
                    R$ {{ register.difference | number:'1.2-2' }}
                  </span>
                </div>
              }
            </div>
          </div>

          @if (register.status === 'OPEN' && isAdmin) {
            <div class="cash-register__actions animate-slide-up" style="animation-delay: 100ms">
              <button class="btn btn-outline btn-lg" (click)="showSangriaModal = true">
                ↓ Sangria
              </button>
              <button class="btn btn-outline btn-lg" (click)="showSuprimentoModal = true">
                ↑ Suprimento
              </button>
              <button class="btn btn-primary btn-lg" (click)="showCloseModal = true">
                Fechar Caixa
              </button>
            </div>
          }

          <!-- Movements -->
          <div class="cash-register__movements animate-slide-up" style="animation-delay: 200ms">
            <h3 class="title-lg">Movimentações</h3>
            @for (mov of register.movements; track mov.id) {
              <div class="movement-row">
                <div class="movement-row__type">
                  <span class="badge" [class.badge--accent]="isInflow(mov.type)" [class.badge--primary]="!isInflow(mov.type)">
                    {{ mov.type }}
                  </span>
                </div>
                <div class="movement-row__desc body-sm">{{ mov.description || '—' }}</div>
                <div class="movement-row__amount title-md" [class.text-accent]="isInflow(mov.type)" [class.text-error]="!isInflow(mov.type)">
                  {{ isInflow(mov.type) ? '+' : '-' }} R$ {{ mov.amount | number:'1.2-2' }}
                </div>
              </div>
            }
            @if (register.movements.length === 0) {
              <p class="body-sm text-muted" style="padding: var(--space-4) 0">Sem movimentações</p>
            }
          </div>
        </div>
      }
    </div>

    <!-- Sangria Modal -->
    @if (showSangriaModal) {
      <div class="glass-overlay" (click)="showSangriaModal = false">
        <div class="modal-card card animate-scale-in" (click)="$event.stopPropagation()">
          <h3 class="headline-md">Sangria</h3>
          <p class="body-sm text-muted">Retirada de dinheiro do caixa</p>
          <form class="modal-form" (ngSubmit)="createMovement('sangria')">
            <div class="form-group">
              <label class="label-sm text-muted">VALOR (R$)</label>
              <input class="input-field" type="number" step="0.01" [(ngModel)]="movementForm.amount" name="amount" required />
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">DESCRIÇÃO</label>
              <input class="input-field" [(ngModel)]="movementForm.description" name="description" placeholder="Motivo da sangria" required />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="showSangriaModal = false">Cancelar</button>
              <button type="submit" class="btn btn-primary">Confirmar</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Suprimento Modal -->
    @if (showSuprimentoModal) {
      <div class="glass-overlay" (click)="showSuprimentoModal = false">
        <div class="modal-card card animate-scale-in" (click)="$event.stopPropagation()">
          <h3 class="headline-md">Suprimento</h3>
          <p class="body-sm text-muted">Entrada adicional de dinheiro no caixa</p>
          <form class="modal-form" (ngSubmit)="createMovement('suprimento')">
            <div class="form-group">
              <label class="label-sm text-muted">VALOR (R$)</label>
              <input class="input-field" type="number" step="0.01" [(ngModel)]="movementForm.amount" name="amount" required />
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">DESCRIÇÃO</label>
              <input class="input-field" [(ngModel)]="movementForm.description" name="description" placeholder="Motivo" required />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="showSuprimentoModal = false">Cancelar</button>
              <button type="submit" class="btn btn-primary">Confirmar</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Close Modal -->
    @if (showCloseModal) {
      <div class="glass-overlay" (click)="showCloseModal = false">
        <div class="modal-card card animate-scale-in" (click)="$event.stopPropagation()">
          <h3 class="headline-md">Fechar Caixa</h3>
          <p class="body-sm text-muted">Informe o valor contado fisicamente</p>
          <form class="modal-form" (ngSubmit)="closeRegister()">
            <div class="form-group">
              <label class="label-sm text-muted">VALOR CONTADO (R$)</label>
              <input class="input-field" type="number" step="0.01" [(ngModel)]="closingAmount" name="closing" required />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="showCloseModal = false">Cancelar</button>
              <button type="submit" class="btn btn-primary">Fechar Caixa</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
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
    private authService: AuthService
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
      },
      error: () => {
        this.register = null;
        this.isLoading = false;
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
