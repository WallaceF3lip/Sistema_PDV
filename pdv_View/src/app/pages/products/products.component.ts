import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductCreate, UnitEnum } from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class ProductsComponent implements OnInit {
  products = signal<Product[]>([]);
  isLoading = signal<boolean>(false);
  showModal = false;
  isSaving = false;
  editingProduct: Product | null = null;

  columns: TableColumn[] = [
    { key: 'name', label: 'Produto'},
    { key: 'sku', label: 'SKU'},
    { key: 'cost_price', label: 'Custo'},
    { key: 'sale_price', label: 'Venda'},
    { key: 'unit', label: 'Unidade', width: '100px', align: 'center' },
    { key: 'is_active', label: 'Ativo', width: '80px', align: 'center' },
    { key: 'actions', label: '', width: '80px', align: 'center' },
  ];

  form: ProductCreate = {
    sku: '',
    name: '',
    cost_price: 0,
    sale_price: 0,
    unit: UnitEnum.UN,
  };

  constructor(
    private productService: ProductService,
    private toastService: ToastService,
    protected authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.productService.list(false).subscribe({
      next: (list) => {
        this.products.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  openModal(): void {
    this.editingProduct = null;
    this.form = { sku: '', name: '', cost_price: 0, sale_price: 0, unit: UnitEnum.UN };
    this.showModal = true;
  }

  editProduct(product: Product): void {
    this.editingProduct = product;
    this.form = {
      sku: product.sku,
      name: product.name,
      cost_price: product.cost_price,
      sale_price: product.sale_price,
      unit: product.unit,
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingProduct = null;
  }

  saveProduct(): void {
    this.isSaving = true;
    if (this.editingProduct) {
      this.productService.update(this.editingProduct.id, this.form).subscribe({
        next: () => {
          this.toastService.success('Produto atualizado!');
          this.closeModal();
          this.loadProducts();
          this.isSaving = false;
        },
        error: () => (this.isSaving = false),
      });
    } else {
      this.productService.create(this.form).subscribe({
        next: () => {
          this.toastService.success('Produto criado!');
          this.closeModal();
          this.loadProducts();
          this.isSaving = false;
        },
        error: () => (this.isSaving = false),
      });
    }
  }

  toggleProduct(product: Product): void {
    this.productService.update(product.id, { is_active: !product.is_active }).subscribe({
      next: () => {
        this.products.update(list =>
          list.map(p => p.id === product.id ? { ...p, is_active: !product.is_active } : p)
        );
        this.toastService.success(
          !product.is_active ? 'Produto ativado' : 'Produto desativado'
        );
      },
    });
  }
}
