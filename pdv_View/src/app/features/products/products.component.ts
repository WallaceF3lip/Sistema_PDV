import { Component, OnInit } from '@angular/core';
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
  template: `
    <div class="products">
      <div class="products__header">
        <div>
          <h2 class="headline-lg">Produtos</h2>
          <p class="body-md text-muted">Gerencie o catálogo de produtos</p>
        </div>
        @if (isAdmin) {
          <button class="btn btn-primary" (click)="openModal()">
            + Novo Produto
          </button>
        }
      </div>

      <div class="products__list">
        @for (product of products; track product.id; let i = $index) {
          <div class="product-row card animate-slide-up" [style.animation-delay]="(i * 40) + 'ms'">
            <div class="product-row__info">
              <div class="product-row__sku label-sm text-muted">{{ product.sku }}</div>
              <div class="product-row__name title-md">{{ product.name }}</div>
            </div>
            <div class="product-row__prices">
              <span class="body-sm text-muted">Custo</span>
              <span class="title-md">R$ {{ product.cost_price | number:'1.2-2' }}</span>
            </div>
            <div class="product-row__prices">
              <span class="body-sm text-muted">Venda</span>
              <span class="title-md text-accent">R$ {{ product.sale_price | number:'1.2-2' }}</span>
            </div>
            <div class="product-row__unit">
              <span class="badge badge--muted">{{ product.unit }}</span>
            </div>
            <div class="product-row__status">
              <div
                class="toggle"
                [class.active]="product.is_active"
                (click)="toggleProduct(product)"
              ></div>
            </div>
            @if (isAdmin) {
              <button class="btn btn-ghost" (click)="editProduct(product)">Editar</button>
            }
          </div>
        }

        @if (products.length === 0 && !isLoading) {
          <div class="products__empty card">
            <p class="body-lg text-muted">Nenhum produto cadastrado</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal) {
      <div class="glass-overlay" (click)="closeModal()">
        <div class="modal-card card animate-scale-in" (click)="$event.stopPropagation()">
          <h3 class="headline-md">{{ editingProduct ? 'Editar Produto' : 'Novo Produto' }}</h3>

          <form class="modal-form" (ngSubmit)="saveProduct()">
            @if (!editingProduct) {
              <div class="form-group">
                <label class="label-sm text-muted">SKU</label>
                <input class="input-field" [(ngModel)]="form.sku" name="sku" placeholder="Ex: PROD001" required />
              </div>
            }
            <div class="form-group">
              <label class="label-sm text-muted">NOME</label>
              <input class="input-field" [(ngModel)]="form.name" name="name" placeholder="Nome do produto" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label-sm text-muted">PREÇO DE CUSTO</label>
                <input class="input-field" type="number" step="0.01" [(ngModel)]="form.cost_price" name="cost_price" required />
              </div>
              <div class="form-group">
                <label class="label-sm text-muted">PREÇO DE VENDA</label>
                <input class="input-field" type="number" step="0.01" [(ngModel)]="form.sale_price" name="sale_price" required />
              </div>
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">UNIDADE</label>
              <select class="input-field" [(ngModel)]="form.unit" name="unit">
                <option value="UN">Unidade (UN)</option>
                <option value="KG">Quilograma (KG)</option>
                <option value="LT">Litro (LT)</option>
              </select>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="isSaving">
                {{ isSaving ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styleUrl: './products.scss',
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  isLoading = false;
  showModal = false;
  isSaving = false;
  editingProduct: Product | null = null;

  form: any = {
    sku: '',
    name: '',
    cost_price: 0,
    sale_price: 0,
    unit: 'UN',
  };

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  constructor(
    private productService: ProductService,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.productService.list(false).subscribe({
      next: (products) => {
        this.products = products;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
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
