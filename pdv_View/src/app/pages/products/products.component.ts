import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductCreate, UnitEnum } from '../../core/models';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  isLoading = false;
  showModal = false;
  isSaving = false;
  editingProduct: Product | null = null;
  isAdmin = false;

  form: any = {
    sku: '',
    name: '',
    cost_price: 0,
    sale_price: 0,
    unit: 'UN',
  };

  constructor(
    private productService: ProductService,
    private toastService: ToastService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.authService.isAdmin$.subscribe((admin) => {
      this.isAdmin = admin;
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.productService.list(false).subscribe({
      next: (products) => {
        this.products = products;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openModal(): void {
    this.editingProduct = null;
    this.form = { sku: '', name: '', cost_price: 0, sale_price: 0, unit: 'UN' };
    this.showModal = true;
  }

  editProduct(product: Product): void {
    this.editingProduct = product;
    this.form = {
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
    this.productService
      .update(product.id, { is_active: !product.is_active })
      .subscribe({
        next: () => {
          product.is_active = !product.is_active;
          this.toastService.success(
            product.is_active ? 'Produto ativado' : 'Produto desativado'
          );
        },
      });
  }
}
