import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../core/services/stock.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { Stock, Product, StockAdjust } from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './stock.html',
  styleUrl: './stock.scss',
})
export class StockComponent implements OnInit {
  stockItems = signal<Stock[]>([]);
  isLoading = signal<boolean>(false);
  showModal = false;
  isSaving = false;
  modalType: 'in' | 'adjust' = 'in';
  selectedStock: Stock | null = null;
  adjustForm: StockAdjust = { quantity: 0, min_quantity: 0, reason: '' };

  columns: TableColumn[] = [
    { key: 'product.name', label: 'Produto'},
    { key: 'product.sku',label: 'SKU'},
    { key: 'quantity',label: 'Qtd. atual', align: 'center' },
    { key: 'min_quantity',label: 'Mínimo', align: 'center' },
    { key: 'actions-in',label: '', align: 'center', width: '80px'},
    { key: 'actions-edit',label: '', align: 'center', width: '60px'},
  ];

  constructor(
    private stockService: StockService,
    private productService: ProductService,
    private toastService: ToastService,
    protected authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.stockService.list().subscribe({
      next: (items) => {
        this.stockItems.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  openAdjustModal(stock: Stock, type: 'in' | 'adjust'): void {
    this.selectedStock = stock;
    this.modalType = type;
    this.adjustForm = {
      quantity: this.modalType === 'in' ? 1 : stock.quantity,
      min_quantity: stock.min_quantity,
      reason: '',
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedStock = null;
  }

  saveAdjust(): void {
    if (!this.selectedStock) return;
    this.isSaving = true;

    if (!this.adjustForm.reason) {
      this.toastService.error('Preencha o campo Motivo!');
      this.isSaving = false;
      return;
    }

    const obs =
      this.modalType === 'in'
        ? this.stockService.stockIn(this.selectedStock.product.id, this.adjustForm)
        : this.stockService.adjust(this.selectedStock.product.id, this.adjustForm);

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
