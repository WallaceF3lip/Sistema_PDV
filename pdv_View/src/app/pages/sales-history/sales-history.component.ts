import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../core/services/sale.service';
import { Sale, SaleStatusEnum } from '../../core/models';
import {
  DataTableComponent,
  DtCellDirective,
  TableColumn,
} from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './sales-history.html',
  styleUrl: './sales-history.scss',
})
export class SalesHistoryComponent implements OnInit {
  // ─── Estado ────────────────────────────────────────────────────────────────
  sales = signal<Sale[]>([]);
  isLoading = signal<boolean>(false);

  // ─── Filtros ───────────────────────────────────────────────────────────────
  filterProduct = '';
  filterClient = '';
  filterDateFrom = '';
  filterDateTo = '';

  // ─── Colunas da tabela ─────────────────────────────────────────────────────
  columns: TableColumn[] = [
    { key: 'id', label: '#', width: '60px', align: 'center' },
    { key: 'customer_name', label: 'Cliente' },
    {key: 'order_type', label: 'Tipo', width: '120px', align: 'center' },
    { key: 'status', label: 'Status', width: '120px', align: 'center' },
    { key: 'total_amount', label: 'Total', width: '140px', align: 'right' },
    { key: 'opened_at', label: 'Abertura', width: '155px' },
    { key: 'closed_at', label: 'Fechamento', width: '155px' },
    { key: 'actions', label: '', width: '90px', align: 'center' },
  ];

  // ─── Computed: filtros client-side ─────────────────────────────────────────
  /**
   * Aplica os filtros de produto e cliente sobre as vendas carregadas.
   *
   * Filtro de produto: o modelo SaleItem não expõe o nome do produto,
   * apenas o product_id. A busca é feita convertendo product_id para string
   * e comparando com o texto digitado. Quando o backend retornar o nome,
   * este computed pode ser atualizado sem mudança estrutural.
   */
  filteredSales = computed(() => {
    const all = this.sales();
    const productQuery = this.filterProduct.trim().toLowerCase();
    const clientQuery = this.filterClient.trim().toLowerCase();

    return all.filter((sale) => {
      // Filtro por produto (via product_id como fallback)
      if (productQuery) {
        const hasProduct = sale.items.some((item) =>
          String(item.product_id).includes(productQuery)
        );
        if (!hasProduct) return false;
      }

      // Filtro por nome do cliente
      if (clientQuery) {
        const clientName = (sale.customer_name ?? '').toLowerCase();
        if (!clientName.includes(clientQuery)) return false;
      }

      return true;
    });
  });

  constructor(private saleService: SaleService) {}

  ngOnInit(): void {
    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo'
    });    
    this.filterDateFrom = today;
    this.filterDateTo = today;
    this.loadSales();
  }

  // ─── Carregamento de dados ─────────────────────────────────────────────────
  loadSales(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;

    this.isLoading.set(true);
    this.saleService.list(this.filterDateFrom, this.filterDateTo).subscribe({
      next: (data) => {
        this.sales.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  // ─── Helpers de status ─────────────────────────────────────────────────────
  getStatusLabel(status: SaleStatusEnum): string {
    const labels: Record<SaleStatusEnum, string> = {
      [SaleStatusEnum.PAID]: 'Pago',
      [SaleStatusEnum.OPEN]: 'Aberta',
      [SaleStatusEnum.PENDING]: 'Pendente',
      [SaleStatusEnum.CANCELED]: 'Cancelada',
    };
    return labels[status] ?? status;
  }

  getStatusClass(status: SaleStatusEnum): string {
    const classes: Record<SaleStatusEnum, string> = {
      [SaleStatusEnum.PAID]: 'badge--success',
      [SaleStatusEnum.OPEN]: 'badge--primary',
      [SaleStatusEnum.PENDING]: 'badge--warning',
      [SaleStatusEnum.CANCELED]: 'badge--danger',
    };
    return classes[status] ?? 'badge--muted';
  }

  // ─── Ações (placeholder) ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEdit(_sale: Sale): void {
    // Placeholder — implementação futura
  }
}
