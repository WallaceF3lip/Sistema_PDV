import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../core/services/stock.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { Stock, StockMovement, Product } from '../../core/models';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stock">
      <div class="stock__header">
        <div>
          <h2 class="headline-lg">Estoque</h2>
          <p class="body-md text-muted">Controle de inventário</p>
        </div>
      </div>

      <div class="stock__list">
        @for (item of stockItems; track item.id; let i = $index) {
          <div class="stock-row card animate-slide-up" [style.animation-delay]="(i * 40) + 'ms'">
            <div class="stock-row__info">
              <div class="stock-row__name title-md">
                {{ getProductName(item.product_id) }}
              </div>
              <div class="body-sm text-muted">
                Mínimo: {{ item.min_quantity }}
              </div>
            </div>
            <div class="stock-row__quantity">
              <span
                class="badge"
                [class.badge--accent]="!item.is_low"
                [class.badge--primary]="item.is_low"
              >
                {{ item.quantity }} {{ getProductUnit(item.product_id) }}
              </span>
            </div>
            @if (isAdmin) {
              <div class="stock-row__actions">
                <button class="btn btn-ghost" (click)="openAdjustModal(item, 'in')">+ Entrada</button>
                <button class="btn btn-ghost" (click)="openAdjustModal(item, 'adjust')">Ajustar</button>
              </div>
            }
          </div>
        }

        @if (stockItems.length === 0 && !isLoading) {
          <div class="stock__empty card">
            <p class="body-lg text-muted">Nenhum item em estoque</p>
          </div>
        }
      </div>
    </div>

    @if (showModal) {
      <div class="glass-overlay" (click)="closeModal()">
        <div class="modal-card card animate-scale-in" (click)="$event.stopPropagation()">
          <h3 class="headline-md">
            {{ modalType === 'in' ? 'Entrada de Estoque' : 'Ajuste de Estoque' }}
          </h3>
          <p class="body-sm text-muted">{{ getProductName(selectedStock!.product_id) }}</p>

          <form class="modal-form" (ngSubmit)="saveAdjust()">
            <div class="form-group">
              <label class="label-sm text-muted">QUANTIDADE</label>
              <input class="input-field" type="number" step="0.001" [(ngModel)]="adjustForm.quantity" name="quantity" required />
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">MOTIVO</label>
              <input class="input-field" [(ngModel)]="adjustForm.reason" name="reason" placeholder="Ex: Reposição semanal" required />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="isSaving">
                {{ isSaving ? 'Salvando...' : 'Confirmar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styleUrl: './stock.scss',
})
export class StockComponent implements OnInit {
  stockItems: Stock[] = [];
  products: Product[] = [];
  isLoading = false;
  showModal = false;
  isSaving = false;
  modalType: 'in' | 'adjust' = 'in';
  selectedStock: Stock | null = null;
  adjustForm = { quantity: 0, reason: '' };

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  constructor(
    private stockService: StockService,
    private productService: ProductService,
    private toastService: ToastService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.productService.list(false).subscribe((products) => {
      this.products = products;
      this.stockService.list().subscribe({
        next: (items) => {
          this.stockItems = items;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
    });
  }

  getProductName(productId: number): string {
    return this.products.find((p) => p.id === productId)?.name || `#${productId}`;
  }

  getProductUnit(productId: number): string {
    return this.products.find((p) => p.id === productId)?.unit || '';
  }

  openAdjustModal(stock: Stock, type: 'in' | 'adjust'): void {
    this.selectedStock = stock;
    this.modalType = type;
    this.adjustForm = { quantity: 0, reason: '' };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedStock = null;
  }

  saveAdjust(): void {
    if (!this.selectedStock) return;
    this.isSaving = true;

    const obs =
      this.modalType === 'in'
        ? this.stockService.stockIn(this.selectedStock.product_id, this.adjustForm)
        : this.stockService.adjust(this.selectedStock.product_id, this.adjustForm);

    obs.subscribe({
      next: () => {
        this.toastService.success(
          this.modalType === 'in' ? 'Entrada registrada!' : 'Estoque ajustado!'
        );
        this.closeModal();
        this.loadData();
        this.isSaving = false;
      },
      error: () => (this.isSaving = false),
    });
  }
}
