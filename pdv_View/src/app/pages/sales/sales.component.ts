import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { Sale, Product, PaymentMethodEnum, PaymentIn, SaleItem } from '../../core/models';

// Local interface for each payment entry in the modal
export interface PaymentEntry {
  method: PaymentMethodEnum;
  amount: number;
}

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
  paymentEntries = signal<PaymentEntry[]>([]);
  isProcessing = signal(false);

  // Edit quantity (KG items)
  showEditQuantity = signal(false);
  editingItem = signal<SaleItem | null>(null);
  newQuantity = signal(0);

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

  /** Total da venda menos a soma das entradas (pode ser negativo quando há troco em dinheiro) */
  remainingAmount = computed(() => {
    const sale = this.currentSale();
    if (!sale) return 0;
    const sum = this.paymentEntries().reduce((acc, e) => acc + (e.amount || 0), 0);
    return Math.round((sale.total_amount - sum) * 100) / 100;
  });

  /** Troco: excedente quando há pelo menos uma entrada CASH e a soma supera o total */
  changeAmount = computed(() => {
    const hasCash = this.paymentEntries().some(e => e.method === PaymentMethodEnum.CASH);
    const remaining = this.remainingAmount();
    if (hasCash && remaining < 0) {
      return Math.round(Math.abs(remaining) * 100) / 100;
    }
    return 0;
  });

  /** Habilita finalização quando a soma cobre o total (tolerância R$ 0,01) e todas as entradas têm valor > 0 */
  canFinalize = computed(() => {
    const sale = this.currentSale();
    if (!sale || this.isProcessing()) return false;
    const entries = this.paymentEntries();
    if (entries.length === 0) return false;
    const allPositive = entries.every(e => e.amount > 0);
    const remaining = this.remainingAmount();
    // Permite finalizar quando remaining <= 0,01 (total coberto) ou há CASH com excedente (troco)
    const covered = remaining <= 0.01;
    return allPositive && covered;
  });

  /** Permite adicionar entrada enquanto existirem menos de 3 e ainda houver valor restante */
  canAddEntry = computed(() => {
    return this.paymentEntries().length < 3 && this.remainingAmount() > 0;
  });

  constructor(
    private saleService: SaleService,
    private productService: ProductService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Restaura venda OPEN existente (se houver) ao abrir a página
    this.saleService.getCurrent().subscribe((sale) => {
      if (sale) {
        this.currentSale.set(sale);
      }
    });

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
      error: () => {
        this.toastService.error('Erro ao atualizar quantidade.');
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
    const sale = this.currentSale();
    if (!sale) return;
    // Inicializa com única entrada cobrindo o total (PIX como padrão)
    this.paymentEntries.set([
      { method: PaymentMethodEnum.PIX, amount: sale.total_amount }
    ]);
    this.showPayment.set(true);
  }

  /** Adiciona nova entrada pré-preenchida com o valor restante */
  addPaymentEntry(): void {
    const remaining = Math.max(0, this.remainingAmount());
    this.paymentEntries.update(entries => [
      ...entries,
      { method: PaymentMethodEnum.PIX, amount: remaining }
    ]);
  }

  /** Remove a entrada pelo índice (a primeira entrada não pode ser removida) */
  removePaymentEntry(index: number): void {
    this.paymentEntries.update(entries => entries.filter((_, i) => i !== index));
  }

  /** Atualiza o método de pagamento de uma entrada (imutável) */
  updateEntryMethod(index: number, method: PaymentMethodEnum): void {
    this.paymentEntries.update(entries =>
      entries.map((e, i) => i === index ? { ...e, method } : e)
    );
  }

  /** Atualiza o valor de uma entrada (imutável) */
  updateEntryAmount(index: number, amount: number): void {
    const parsed = parseFloat(String(amount)) || 0;
    this.paymentEntries.update(entries =>
      entries.map((e, i) => i === index ? { ...e, amount: parsed } : e)
    );
  }

  finalizeSale(): void {
    const sale = this.currentSale();
    if (!sale) return;
    this.isProcessing.set(true);

    // Filtra entradas com valor > 0 e mapeia para PaymentIn[]
    const payments: PaymentIn[] = this.paymentEntries()
      .filter(e => e.amount > 0)
      .map(e => ({ method: e.method, amount: e.amount }));

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
