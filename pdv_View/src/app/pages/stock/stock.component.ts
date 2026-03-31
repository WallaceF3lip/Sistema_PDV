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
  templateUrl: './stock.html',
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
