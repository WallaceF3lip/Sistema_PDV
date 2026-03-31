import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  templateUrl:'./sales.html',
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
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.productService.list().subscribe((products) => {
      this.products = products;
      this.cdr.detectChanges();
    });
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
        next: (sale) => {
          this.currentSale = sale;
          this.cdr.detectChanges();
        },
      });
  }

  removeItem(item: SaleItem): void {
    if (!this.currentSale) return;
    this.saleService.removeItem(this.currentSale.id, item.id).subscribe({
      next: (sale) => {
        this.currentSale = sale;
        this.cdr.detectChanges();
      } ,
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
