import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  Injector,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { ReportService } from '../../core/services/report.service';
import {
  PaymentMethodEnum,
  ReportChannelType,
  SalesSummary,
  TopProductsOrder,
} from '../../core/models';
import {
  DatePreset,
  PRESET_LABELS,
  daysInRange,
  presetRange,
  todayInSaoPaulo,
} from '../../core/utils/date-presets';
import { downloadCsv, formatCsvNumber } from '../../core/utils/csv';
import {
  DataTableComponent,
  DtCellDirective,
  TableColumn,
} from '../../shared/components/data-table/data-table.component';
import {
  AXIS_TICKS,
  CHART_COLORS,
  LEGEND_LABELS,
  TOOLTIP_BASE,
  formatBRL,
} from './chart-theme';

Chart.register(...registerables);

export const MAX_REPORT_DAYS = 366;

const PAYMENT_LABELS: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.CASH]: 'Dinheiro',
  [PaymentMethodEnum.CARD]: 'Cartão',
  [PaymentMethodEnum.PIX]: 'PIX',
};

const CHANNEL_LABELS: Record<ReportChannelType, string> = {
  COUNTER: 'Balcão',
  PICKUP: 'Retirada',
  DELIVERY: 'Entrega',
};

/** YYYY-MM-DD → DD/MM/YYYY */
function brDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class ReportsComponent implements OnInit, OnDestroy {
  @ViewChild('dayChartCanvas') dayChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentChartCanvas') paymentChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('channelChartCanvas') channelChartCanvas?: ElementRef<HTMLCanvasElement>;

  private dayChart: Chart | null = null;
  private paymentChart: Chart | null = null;
  private channelChart: Chart | null = null;
  private requestSeq = 0;
  private readonly injector = inject(Injector);

  readonly presets: { key: DatePreset; label: string }[] = (
    Object.keys(PRESET_LABELS) as DatePreset[]
  ).map((key) => ({ key, label: PRESET_LABELS[key] }));

  // ─── Filtros ──────────────────────────────────────────────────────────────
  startDate = signal<string>('');
  endDate = signal<string>('');
  activePreset = signal<DatePreset | null>('TODAY');
  topBy = signal<TopProductsOrder>('revenue');

  // ─── Estado ───────────────────────────────────────────────────────────────
  summary = signal<SalesSummary | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  rangeError = computed<string | null>(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (!start || !end) return 'Informe as datas inicial e final';
    if (start > end) return 'A data inicial deve ser anterior ou igual à data final';
    if (daysInRange(start, end) > MAX_REPORT_DAYS) {
      return `O período máximo do relatório é de ${MAX_REPORT_DAYS} dias`;
    }
    return null;
  });
  rangeValid = computed(() => this.rangeError() === null);

  hasSales = computed(() => (this.summary()?.totals.paid_count ?? 0) > 0);

  // ─── Tabelas ──────────────────────────────────────────────────────────────
  productColumns: TableColumn[] = [
    { key: 'position', label: '#', width: '56px', align: 'center' },
    { key: 'product_name', label: 'Produto' },
    { key: 'quantity', label: 'Quantidade', width: '130px', align: 'right' },
    { key: 'revenue', label: 'Receita', width: '150px', align: 'right' },
    { key: 'sales_count', label: 'Vendas', width: '100px', align: 'right' },
  ];
  zoneColumns: TableColumn[] = [
    { key: 'zone_name', label: 'Zona' },
    { key: 'count', label: 'Pedidos', width: '100px', align: 'right' },
    { key: 'delivery_fees_total', label: 'Taxas', width: '140px', align: 'right' },
    { key: 'gross_total', label: 'Faturamento', width: '150px', align: 'right' },
  ];
  operatorColumns: TableColumn[] = [
    { key: 'user_name', label: 'Operador' },
    { key: 'count', label: 'Pedidos', width: '100px', align: 'right' },
    { key: 'gross_total', label: 'Faturamento', width: '150px', align: 'right' },
  ];

  topProducts = computed(() =>
    (this.summary()?.top_products ?? []).map((p, i) => ({
      ...p,
      position: i + 1,
      quantity: Number(p.quantity),
      revenue: Number(p.revenue),
    }))
  );
  zones = computed(() =>
    (this.summary()?.by_zone ?? []).map((z) => ({
      ...z,
      delivery_fees_total: Number(z.delivery_fees_total),
      gross_total: Number(z.gross_total),
    }))
  );
  operators = computed(() =>
    (this.summary()?.by_operator ?? []).map((o) => ({ ...o, gross_total: Number(o.gross_total) }))
  );

  constructor(private reportService: ReportService) {}

  ngOnInit(): void {
    this.applyPreset('TODAY');
  }

  ngOnDestroy(): void {
    this.requestSeq++;
    this.destroyCharts();
  }

  // ─── Ações ────────────────────────────────────────────────────────────────
  applyPreset(preset: DatePreset): void {
    const range = presetRange(preset, todayInSaoPaulo());
    this.startDate.set(range.start);
    this.endDate.set(range.end);
    this.activePreset.set(preset);
    this.load();
  }

  onStartDateChange(value: string): void {
    this.startDate.set(value);
    this.activePreset.set(null);
  }

  onEndDateChange(value: string): void {
    this.endDate.set(value);
    this.activePreset.set(null);
  }

  applyRange(): void {
    this.load();
  }

  setTopBy(value: TopProductsOrder): void {
    if (this.topBy() === value) return;
    this.topBy.set(value);
    this.load();
  }

  load(): void {
    if (!this.rangeValid()) return;
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);

    this.reportService
      .getSalesSummary(this.startDate(), this.endDate(), { topBy: this.topBy() })
      .subscribe({
        next: (summary) => {
          if (seq !== this.requestSeq) return;
          this.summary.set(summary);
          this.loading.set(false);
          // Aguarda o template refletir o novo estado antes de desenhar
          afterNextRender(
            () => {
              if (seq === this.requestSeq) this.renderCharts(summary);
            },
            { injector: this.injector }
          );
        },
        error: (err: HttpErrorResponse) => {
          if (seq !== this.requestSeq) return;
          this.loading.set(false);
          const detail = err?.error?.detail;
          this.error.set(typeof detail === 'string' ? detail : 'Não foi possível carregar o relatório');
        },
      });
  }

  // ─── Formatação ───────────────────────────────────────────────────────────
  brl(value: number | string | null | undefined): string {
    return formatBRL(value);
  }

  qty(value: number | string | null | undefined): string {
    return Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  }

  periodLabel(): string {
    const s = this.summary();
    if (!s) return '';
    return s.start_date === s.end_date
      ? brDate(s.start_date)
      : `${brDate(s.start_date)} a ${brDate(s.end_date)}`;
  }

  // ─── Exportação CSV ───────────────────────────────────────────────────────
  exportDaysCsv(): void {
    const s = this.summary();
    if (!s) return;
    downloadCsv(
      `vendas-por-dia_${s.start_date}_${s.end_date}.csv`,
      ['Data', 'Pedidos', 'Faturamento', 'Itens', 'Taxas de entrega'],
      s.by_day.map((d) => [
        brDate(d.date),
        String(d.count),
        Number(d.gross_total),
        Number(d.items_total),
        Number(d.delivery_fees_total),
      ])
    );
  }

  exportProductsCsv(): void {
    const s = this.summary();
    if (!s) return;
    downloadCsv(
      `produtos-mais-vendidos_${s.start_date}_${s.end_date}.csv`,
      ['Produto', 'Quantidade', 'Receita', 'Vendas'],
      s.top_products.map((p) => [
        p.product_name,
        formatCsvNumber(Number(p.quantity), 3),
        Number(p.revenue),
        String(p.sales_count),
      ])
    );
  }

  // ─── Gráficos ─────────────────────────────────────────────────────────────
  private destroyCharts(): void {
    this.dayChart?.destroy();
    this.paymentChart?.destroy();
    this.channelChart?.destroy();
    this.dayChart = this.paymentChart = this.channelChart = null;
  }

  private renderCharts(summary: SalesSummary): void {
    this.destroyCharts();
    if (summary.totals.paid_count === 0) return;
    this.buildDayChart(summary);
    this.buildPaymentChart(summary);
    this.buildChannelChart(summary);
  }

  private buildDayChart(summary: SalesSummary): void {
    const canvas = this.dayChartCanvas?.nativeElement;
    if (!canvas) return;
    const labels = summary.by_day.map((d) => brDate(d.date).slice(0, 5));
    this.dayChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Faturamento (R$)',
            data: summary.by_day.map((d) => Number(d.gross_total)),
            backgroundColor: CHART_COLORS.primaryFill,
            borderColor: CHART_COLORS.primary,
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line',
            label: 'Pedidos',
            data: summary.by_day.map((d) => d.count),
            borderColor: CHART_COLORS.accent,
            backgroundColor: CHART_COLORS.accent,
            borderWidth: 2,
            pointRadius: summary.by_day.length > 45 ? 0 : 3,
            tension: 0.3,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: LEGEND_LABELS },
          tooltip: {
            ...TOOLTIP_BASE,
            callbacks: {
              title: (items) => brDate(summary.by_day[items[0].dataIndex].date),
              label: (ctx) =>
                ctx.datasetIndex === 0 ? ` ${formatBRL(Number(ctx.raw))}` : ` ${ctx.raw} pedidos`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: AXIS_TICKS },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: CHART_COLORS.grid },
            ticks: { ...AXIS_TICKS, callback: (v) => `R$ ${v}` },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { ...AXIS_TICKS, precision: 0 },
          },
        },
      },
    });
  }

  private buildPaymentChart(summary: SalesSummary): void {
    const canvas = this.paymentChartCanvas?.nativeElement;
    if (!canvas) return;
    const methods = summary.by_payment_method;
    const colors: Record<PaymentMethodEnum, [string, string]> = {
      [PaymentMethodEnum.CASH]: [CHART_COLORS.accent, CHART_COLORS.accentBorder],
      [PaymentMethodEnum.CARD]: [CHART_COLORS.primary, CHART_COLORS.primaryBorder],
      [PaymentMethodEnum.PIX]: [CHART_COLORS.blue, CHART_COLORS.blueBorder],
    };
    this.paymentChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: methods.map((m) => PAYMENT_LABELS[m.method] ?? m.method),
        datasets: [
          {
            data: methods.map((m) => Number(m.amount)),
            backgroundColor: methods.map((m) => colors[m.method]?.[0] ?? CHART_COLORS.muted),
            borderColor: methods.map((m) => colors[m.method]?.[1] ?? CHART_COLORS.muted),
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: LEGEND_LABELS },
          tooltip: {
            ...TOOLTIP_BASE,
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((Number(ctx.raw) / total) * 100).toFixed(1) : '0';
                return ` ${formatBRL(Number(ctx.raw))} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  private buildChannelChart(summary: SalesSummary): void {
    const canvas = this.channelChartCanvas?.nativeElement;
    if (!canvas) return;
    const channels = summary.by_channel;
    this.channelChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: channels.map((c) => CHANNEL_LABELS[c.channel] ?? c.channel),
        datasets: [
          {
            label: 'Faturamento (R$)',
            data: channels.map((c) => Number(c.gross_total)),
            backgroundColor: [CHART_COLORS.primaryFill, CHART_COLORS.accentFill, 'rgba(59, 130, 246, 0.75)'],
            borderColor: [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.blue],
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BASE,
            callbacks: {
              label: (ctx) => {
                const c = channels[ctx.dataIndex];
                return ` ${formatBRL(Number(ctx.raw))} · ${c.count} pedidos`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: AXIS_TICKS },
          y: {
            beginAtZero: true,
            grid: { color: CHART_COLORS.grid },
            ticks: { ...AXIS_TICKS, callback: (v) => `R$ ${v}` },
          },
        },
      },
    });
  }
}
