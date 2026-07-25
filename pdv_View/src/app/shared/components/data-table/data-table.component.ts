import {
  Component,
  Input,
  ContentChildren,
  QueryList,
  TemplateRef,
  Directive,
  signal,
  Signal,
  computed,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Diretiva aplicada em ng-template para identificar templates de célula */
@Directive({ selector: '[dtCell]', standalone: true })
export class DtCellDirective {
  @Input('dtCell') key!: string;
  constructor(public templateRef: TemplateRef<{ $implicit: any; row: any }>) {}
}

/** Definição de uma coluna da tabela */
export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTableComponent<T extends Record<string, any>> implements OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() emptyMessage = 'Nenhum item encontrado';
  @Input() loading = signal<boolean>(false);

  /**
   * Habilita a paginação client-side do componente.
   * Padrão: false — mantém o comportamento atual (exibe todos os itens).
   *
   * Para datasets > 500 registros, recomenda-se paginação server-side.
   */
  @Input() paginate = false;

  /**
   * Número de itens exibidos por página quando `paginate` está habilitado.
   * Padrão: 10.
   */
  @Input() pageSize = 10;

  /**
   * Aceita Signal<T[]> ou T[].
   * Internamente normaliza para um signal para que o template seja reativo.
   * Ao receber um novo array, reseta a página ativa para 1.
   */
  @Input() set data(value: Signal<T[]> | T[]) {
    if (typeof value === 'function') {
      // É um Signal — usa diretamente
      this._rows = value as Signal<T[]>;
    } else {
      // É um array estático — envolve em signal
      if (this._staticSignal) {
        this._staticSignal.set(value ?? []);
      } else {
        this._staticSignal = signal<T[]>(value ?? []);
        this._rows = this._staticSignal;
      }
    }
    // Reseta para a primeira página sempre que os dados mudam
    this._currentPage.set(1);
  }

  @ContentChildren(DtCellDirective) cellTemplates!: QueryList<DtCellDirective>;

  private _staticSignal: ReturnType<typeof signal<T[]>> | null = null;
  _rows: Signal<T[]> = signal([]);

  // ─── Paginação ───────────────────────────────────────────────────────────
  /** Página atualmente ativa (1-based) */
  readonly _currentPage = signal<number>(1);

  /** Total de páginas calculado a partir dos dados e do pageSize */
  readonly totalPages = computed(() => {
    const len = this._rows().length;
    if (len === 0) return 1;
    return Math.ceil(len / this.pageSize);
  });

  /**
   * Fatia de dados da página atual.
   * Quando `paginate` é false, retorna todos os dados sem fatiar.
   */
  readonly currentPageRows = computed((): T[] => {
    if (!this.paginate) return this._rows();
    const page = this._currentPage();
    const start = (page - 1) * this.pageSize;
    return this._rows().slice(start, start + this.pageSize);
  });

  /**
   * Janela deslizante de no máximo 5 números de página visíveis,
   * centrada na página ativa.
   *
   * Algoritmo:
   *   windowStart = clamp(currentPage - 2, 1, max(1, totalPages - 4))
   *   windowEnd   = min(windowStart + 4, totalPages)
   */
  readonly visiblePages = computed((): number[] => {
    const total = this.totalPages();
    const current = this._currentPage();
    const windowSize = 5;

    const maxStart = Math.max(1, total - (windowSize - 1));
    const windowStart = Math.min(Math.max(current - 2, 1), maxStart);
    const windowEnd = Math.min(windowStart + (windowSize - 1), total);

    const pages: number[] = [];
    for (let i = windowStart; i <= windowEnd; i++) {
      pages.push(i);
    }
    return pages;
  });

  /**
   * As setas de navegação são exibidas somente quando há mais de 5 páginas.
   */
  readonly showArrows = computed(() => this.totalPages() > 5);

  // ─── Métodos de navegação ─────────────────────────────────────────────────

  /** Navega para a página especificada (1-based). */
  goToPage(page: number): void {
    const total = this.totalPages();
    if (page >= 1 && page <= total) {
      this._currentPage.set(page);
    }
  }

  /** Navega para a página anterior, se existir. */
  prevPage(): void {
    if (this._currentPage() > 1) {
      this._currentPage.update(p => p - 1);
    }
  }

  /** Navega para a próxima página, se existir. */
  nextPage(): void {
    if (this._currentPage() < this.totalPages()) {
      this._currentPage.update(p => p + 1);
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    // Garante inicialização do signal se data não for fornecido ainda
    if (!this._rows) {
      this._rows = signal([]);
    }
    // Reseta para a primeira página se pageSize mudar em runtime
    if (changes['pageSize'] && !changes['pageSize'].firstChange) {
      this._currentPage.set(1);
    }
  }

  // ─── Helpers de template ──────────────────────────────────────────────────

  /** Retorna o TemplateRef para uma coluna, se houver */
  getCellTemplate(key: string): TemplateRef<any> | null {
    return this.cellTemplates?.find((t) => t.key === key)?.templateRef ?? null;
  }

  /** Acesso seguro a propriedades aninhadas via dot notation (ex: "product.name") */
  getValue(row: T, key: string): any {
    return key.split('.').reduce((acc: any, k) => acc?.[k], row);
  }
}
