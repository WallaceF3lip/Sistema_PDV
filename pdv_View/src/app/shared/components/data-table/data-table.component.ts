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
   * Aceita Signal<T[]> ou T[].
   * Internamente normaliza para um signal para que o template seja reativo.
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
  }

  @ContentChildren(DtCellDirective) cellTemplates!: QueryList<DtCellDirective>;

  private _staticSignal: ReturnType<typeof signal<T[]>> | null = null;
  _rows: Signal<T[]> = signal([]);

  ngOnChanges(changes: SimpleChanges): void {
    // Garante inicialização do signal se data não for fornecido ainda
    if (!this._rows) {
      this._rows = signal([]);
    }
  }

  /** Retorna o TemplateRef para uma coluna, se houver */
  getCellTemplate(key: string): TemplateRef<any> | null {
    return this.cellTemplates?.find((t) => t.key === key)?.templateRef ?? null;
  }

  /** Acesso seguro a propriedades aninhadas via dot notation (ex: "product.name") */
  getValue(row: T, key: string): any {
    return key.split('.').reduce((acc: any, k) => acc?.[k], row);
  }
}
