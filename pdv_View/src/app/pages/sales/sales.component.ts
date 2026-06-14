import { Component, OnInit, signal, computed } from '@angular/core';
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

  products = signal<Product[]>([]);
  currentSale = signal<Sale | null>(null);
  searchQuery = signal('');
  tappedId = signal<number | null>(null);

  // Payment
  showPayment = signal(false);
  selectedMethod = signal<PaymentMethodEnum>(PaymentMethodEnum.PIX);
  cashReceived = signal(0);
  isProcessing = signal(false);

  paymentMethods = [
    { value: PaymentMethodEnum.PIX, label: 'PIX', icon: '⚡' },
    { value: PaymentMethodEnum.CARD, label: 'Cartão', icon: '💳' },
    { value: PaymentMethodEnum.CASH, label: 'Dinheiro', icon: '💵' },
  ];

  filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const allProducts = this.products();
    if (!query) return allProducts;
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)
    );
  });

  changeAmount = computed(() => {
    const sale = this.currentSale();
    const received = this.cashReceived();
    if (sale && received > sale.total_amount) {
      return received - sale.total_amount;
    }
    return 0;
  });

  canFinalize = computed(() => {
    const sale = this.currentSale();
    const method = this.selectedMethod();
    if (!sale || this.isProcessing()) return false;
    if (method === 'CASH') {
      return this.cashReceived() >= sale.total_amount;
    }
    return true;
  });

  constructor(
    private saleService: SaleService,
    private productService: ProductService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.productService.list().subscribe((products) => {
      this.products.set(products);
    });
  }

  addBySku(): void {
    const product = this.products().find(
      (p) => p.sku.toLowerCase() === this.searchQuery().toLowerCase().trim()
    );
    if (product) {
      this.addProductToCart(product);
      this.searchQuery.set('');
    }
  }

  async addProductToCart(product: Product): Promise<void> {
    console.log("Prod: ", product);
    
    this.tappedId.set(product.id);
    setTimeout(() => this.tappedId.set(null), 200);

    const sale = this.currentSale();
    if (!sale) {
      this.saleService.openSale().subscribe({
        next: (newSale) => {
          this.currentSale.set(newSale);
          this.addItemToSale(product);
        },
      });
    } else {
      this.addItemToSale(product);
    }
  }

  private addItemToSale(product: Product): void {
    const sale = this.currentSale();
    if (!sale) return;
    this.saleService
      .addItem(sale.id, { sku: product.sku, quantity: 1 })
      .subscribe({
        next: (updatedSale) => {
          this.currentSale.set(updatedSale);
        },
      });
  }

  removeItem(item: SaleItem): void {
    console.log("Item: ", item);
    
    const sale = this.currentSale();
    if (!sale) return;
    this.saleService.removeItem(sale.id, item.id).subscribe({
      next: (updatedSale) => {
        this.currentSale.set(updatedSale);
      } ,
    });
  }

  getProductName(productId: number): string {
    return this.products().find((p) => p.id === productId)?.name || `Produto #${productId}`;
  }

  getProductUnit(productId: number): string {
    return this.products().find((p) => p.id === productId)?.unit || '';
  }

  openPayment(): void {
    this.showPayment.set(true);
    this.selectedMethod.set(PaymentMethodEnum.PIX);
    this.cashReceived.set(0);
  }

  calculateChange(): void {
    // Computed property handles this, keeping method signature for HTML template
  }

  finalizeSale(): void {
    const sale = this.currentSale();
    if (!sale) return;
    this.isProcessing.set(true);

    const payments: PaymentIn[] = [
      {
        method: this.selectedMethod(),
        amount: sale.total_amount,
      },
    ];

    this.saleService.finalize(sale.id, { payments }).subscribe({
      next: () => {
        this.toastService.success('Venda finalizada com sucesso!');
        this.showPayment.set(false);
        this.currentSale.set(null);
        this.isProcessing.set(false);
      },
      error: () => this.isProcessing.set(false),
    });
  }
}
