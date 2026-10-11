import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { Sale, Product, SaleItem, CashRegister } from '../../core/models';
import { SaleCheckoutModalComponent } from './sale-checkout-modal/sale-checkout-modal.component';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SaleCheckoutModalComponent],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class SalesComponent implements OnInit {

  products = signal<Product[]>([]);
  currentSale = signal<Sale | null>(null);
  searchQuery = signal('');
  tappedId = signal<number | null>(null);

  // Checkout modal
  showCheckoutModal = signal(false);

  /** Caixa único aberto (null = sem caixa; undefined = ainda não consultado) */
  cashRegister = signal<CashRegister | null | undefined>(undefined);
  /** Aviso "Caixa fechado" só depois de consultar o caixa */
  noCashRegister = computed(() => this.cashRegister() === null);

  // Edit quantity (KG items)
  showEditQuantity = signal(false);
  editingItem = signal<SaleItem | null>(null);
  newQuantity = signal(0);

  filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const allProducts = this.products();
    if (!query) return allProducts;
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)
    );
  });

  constructor(
    private saleService: SaleService,
    private productService: ProductService,
    private toastService: ToastService,
    private cashRegisterService: CashRegisterService,
  ) {}

  ngOnInit(): void {
    this.saleService.getCurrent().subscribe((sale) => {
      if (sale) this.currentSale.set(sale);
    });

    this.productService.list().subscribe((products) => {
      this.products.set(products);
    });

    this.loadCashRegister();
  }

  /** Consulta o caixa compartilhado (200 com null quando não há caixa aberto). */
  loadCashRegister(onLoaded?: (reg: CashRegister | null) => void): void {
    this.cashRegisterService.getCurrent().subscribe({
      next: (reg) => {
        this.cashRegister.set(reg);
        onLoaded?.(reg);
      },
      error: () => {
        this.cashRegister.set(null);
        onLoaded?.(null);
      },
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
    this.saleService.addItem(sale.id, { sku: product.sku, quantity: 1 }).subscribe({
      next: (updatedSale) => this.currentSale.set(updatedSale),
    });
  }

  editQuantity(item: SaleItem): void {
    this.editingItem.set(item);
    this.newQuantity.set(item.quantity);
    this.showEditQuantity.set(true);
  }

  confirmEditQuantity(): void {
    const sale = this.currentSale();
    const item = this.editingItem();
    const qty = this.newQuantity();
    if (!sale || !item || qty <= 0) return;

    this.saleService.updateItem(sale.id, item.id, qty).subscribe({
      next: (updatedSale) => {
        this.currentSale.set(updatedSale);
        this.showEditQuantity.set(false);
        this.editingItem.set(null);
        this.toastService.success('Quantidade atualizada!');
      },
      error: () => this.toastService.error('Erro ao atualizar quantidade.'),
    });
  }

  removeItem(item: SaleItem): void {
    const sale = this.currentSale();
    if (!sale) return;
    this.saleService.removeItem(sale.id, item.id).subscribe({
      next: (updatedSale) => this.currentSale.set(updatedSale),
    });
  }

  getProductName(productId: number): string {
    return this.products().find((p) => p.id === productId)?.name || `Produto #${productId}`;
  }

  getProductUnit(productId: number): string {
    return this.products().find((p) => p.id === productId)?.unit || '';
  }

  // ─── Checkout Modal ─────────────────────────────────────────────────────────

  /** Reconsulta o caixa antes de abrir o checkout; sem caixa, não abre. */
  openCheckout(): void {
    this.loadCashRegister((reg) => {
      if (reg) {
        this.showCheckoutModal.set(true);
      } else {
        this.toastService.warning('Caixa fechado — abra o caixa para finalizar vendas');
      }
    });
  }

  onCheckoutCompleted(): void {
    this.currentSale.set(null);
    this.showCheckoutModal.set(false);
  }

  onCheckoutCancelled(): void {
    this.showCheckoutModal.set(false);
  }

  /** Taxa de entrega da venda aberta (Decimal chega como string) */
  cartDeliveryFee = computed(() => Number(this.currentSale()?.delivery_fee ?? 0));

  /** Detalhes salvos no checkout (ex.: taxa de entrega): mantém o carrinho em sincronia */
  onCheckoutSaleUpdated(sale: Sale): void {
    this.currentSale.set(sale);
  }
}
