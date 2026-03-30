import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { Sale, Product, PaymentMethodEnum, PaymentIn, SaleItem } from '../../core/models';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sales-pdv">
      <!-- Left: Product Menu -->
      <div class="sales-pdv__menu">
        <div class="menu-header">
          <h2 class="headline-lg">Vendas</h2>
          <input
            class="input-field search-bar"
            type="text"
            placeholder="Buscar por nome ou SKU..."
            [(ngModel)]="searchQuery"
            (keydown.enter)="addBySku()"
            id="search-input"
          />
        </div>

        <div class="product-grid">
          @for (product of filteredProducts; track product.id) {
            <div
              class="product-card card"
              [class.animate-scale-tap]="tappedId === product.id"
              (click)="addProductToCart(product)"
            >
              <div class="product-card__name body-lg">{{ product.name }}</div>
              <div class="product-card__sku label-sm text-muted">{{ product.sku }}</div>
              <div class="product-card__price title-lg text-accent">
                R$ {{ product.sale_price | number:'1.2-2' }}
              </div>
            </div>
          }

          @if (filteredProducts.length === 0) {
            <div class="product-grid__empty">
              <p class="body-md text-muted">Nenhum produto encontrado</p>
            </div>
          }
        </div>
      </div>

      <!-- Right: Cart -->
      <div class="sales-pdv__cart">
        <div class="cart-header">
          <h3 class="title-lg">Carrinho</h3>
          @if (currentSale) {
            <span class="badge badge--muted">Venda #{{ currentSale.id }}</span>
          }
        </div>

        <div class="cart-items">
          @if (!currentSale) {
            <div class="cart-empty">
              <p class="body-md text-muted">Clique em um produto para iniciar uma venda</p>
            </div>
          } @else {
            @for (item of currentSale.items; track item.id; let i = $index) {
              <div class="cart-item animate-slide-up" [style.animation-delay]="(i * 30) + 'ms'">
                <div class="cart-item__info">
                  <span class="body-md">{{ getProductName(item.product_id) }}</span>
                  <span class="body-sm text-muted">{{ item.quantity }} × R$ {{ item.unit_price | number:'1.2-2' }}</span>
                </div>
                <div class="cart-item__right">
                  <span class="title-md">R$ {{ item.subtotal | number:'1.2-2' }}</span>
                  <button class="btn-remove" (click)="removeItem(item)">✕</button>
                </div>
              </div>
            }

            @if (currentSale.items.length === 0) {
              <div class="cart-empty">
                <p class="body-sm text-muted">Carrinho vazio — adicione produtos</p>
              </div>
            }
          }
        </div>

        <div class="cart-footer">
          <div class="cart-total">
            <span class="body-md text-muted">Total</span>
            <span class="display-md">R$ {{ currentSale?.total_amount || 0 | number:'1.2-2' }}</span>
          </div>
          <button
            class="btn btn-primary btn-lg btn-block"
            [disabled]="!currentSale || currentSale.items.length === 0"
            (click)="openPayment()"
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    @if (showPayment && currentSale) {
      <div class="glass-overlay">
        <div class="payment-modal card animate-scale-in">
          <div class="payment-modal__header">
            <h3 class="headline-md">Pagamento</h3>
            <button class="btn btn-ghost" (click)="showPayment = false">✕</button>
          </div>

          <div class="payment-modal__amount">
            <span class="label-sm text-muted">VALOR A PAGAR</span>
            <span class="payment-total">R$ {{ currentSale.total_amount | number:'1.2-2' }}</span>
          </div>

          <div class="payment-modal__methods">
            @for (method of paymentMethods; track method.value) {
              <button
                class="tender-btn"
                [class.tender-btn--active]="selectedMethod === method.value"
                (click)="selectedMethod = method.value"
              >
                <span class="tender-btn__icon">{{ method.icon }}</span>
                <span class="tender-btn__label title-md">{{ method.label }}</span>
              </button>
            }
          </div>

          @if (selectedMethod === 'CASH') {
            <div class="payment-modal__cash">
              <div class="form-group">
                <label class="label-sm text-muted">VALOR RECEBIDO</label>
                <input
                  class="input-field cash-input"
                  type="number"
                  step="0.01"
                  [(ngModel)]="cashReceived"
                  (ngModelChange)="calculateChange()"
                />
              </div>
              @if (changeAmount > 0) {
                <div class="change-display animate-fade-in">
                  <span class="label-sm text-muted">TROCO</span>
                  <span class="headline-lg text-accent">R$ {{ changeAmount | number:'1.2-2' }}</span>
                </div>
              }
            </div>
          }

          <button
            class="btn btn-primary btn-lg btn-block"
            [disabled]="!canFinalize()"
            (click)="finalizeSale()"
          >
            {{ isProcessing ? 'Processando...' : 'Finalizar Venda' }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './sales.scss',
})
export class SalesComponent implements OnInit {
  products: Product[] = [];
  currentSale: Sale | null = null;
  searchQuery = '';
  tappedId: number | null = null;

  // Payment
  showPayment = false;
  selectedMethod: PaymentMethodEnum = PaymentMethodEnum.PIX;
  cashReceived = 0;
  changeAmount = 0;
  isProcessing = false;

  paymentMethods = [
    { value: PaymentMethodEnum.PIX, label: 'PIX', icon: '⚡' },
    { value: PaymentMethodEnum.CARD, label: 'Cartão', icon: '💳' },
    { value: PaymentMethodEnum.CASH, label: 'Dinheiro', icon: '💵' },
  ];

  get filteredProducts(): Product[] {
    if (!this.searchQuery.trim()) return this.products;
    const q = this.searchQuery.toLowerCase().trim();
    return this.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }

  constructor(
    private saleService: SaleService,
    private productService: ProductService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.productService.list().subscribe((products) => (this.products = products));
  }

  addBySku(): void {
    const product = this.products.find(
      (p) => p.sku.toLowerCase() === this.searchQuery.toLowerCase().trim()
    );
    if (product) {
      this.addProductToCart(product);
      this.searchQuery = '';
    }
  }

  async addProductToCart(product: Product): Promise<void> {
    this.tappedId = product.id;
    setTimeout(() => (this.tappedId = null), 200);

    if (!this.currentSale) {
      this.saleService.openSale().subscribe({
        next: (sale) => {
          this.currentSale = sale;
          this.addItemToSale(product);
        },
      });
    } else {
      this.addItemToSale(product);
    }
  }

  private addItemToSale(product: Product): void {
    if (!this.currentSale) return;
    this.saleService
      .addItem(this.currentSale.id, { sku: product.sku, quantity: 1 })
      .subscribe({
        next: (sale) => (this.currentSale = sale),
      });
  }

  removeItem(item: SaleItem): void {
    if (!this.currentSale) return;
    this.saleService.removeItem(this.currentSale.id, item.id).subscribe({
      next: (sale) => (this.currentSale = sale),
    });
  }

  getProductName(productId: number): string {
    return this.products.find((p) => p.id === productId)?.name || `Produto #${productId}`;
  }

  openPayment(): void {
    this.showPayment = true;
    this.selectedMethod = PaymentMethodEnum.PIX;
    this.cashReceived = 0;
    this.changeAmount = 0;
  }

  calculateChange(): void {
    if (this.currentSale && this.cashReceived > this.currentSale.total_amount) {
      this.changeAmount = this.cashReceived - this.currentSale.total_amount;
    } else {
      this.changeAmount = 0;
    }
  }

  canFinalize(): boolean {
    if (!this.currentSale || this.isProcessing) return false;
    if (this.selectedMethod === 'CASH') {
      return this.cashReceived >= this.currentSale.total_amount;
    }
    return true;
  }

  finalizeSale(): void {
    if (!this.currentSale) return;
    this.isProcessing = true;

    const payments: PaymentIn[] = [
      {
        method: this.selectedMethod,
        amount: this.currentSale.total_amount,
      },
    ];

    this.saleService.finalize(this.currentSale.id, { payments }).subscribe({
      next: () => {
        this.toastService.success('Venda finalizada com sucesso!');
        this.showPayment = false;
        this.currentSale = null;
        this.isProcessing = false;
      },
      error: () => (this.isProcessing = false),
    });
  }
}
