import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { Sale, SaleStatusEnum, PaymentMethodEnum } from '../../core/models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface DashboardCard {
  icon: string;
  label: string;
  description: string;
  route: string;
  highlighted?: boolean;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barChartCanvas') barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChartCanvas') pieChartCanvas!: ElementRef<HTMLCanvasElement>;

  private barChart: Chart | null = null;
  private pieChart: Chart | null = null;
  private viewReady = false;
  private pendingSales: Sale[] | null = null;

  totalSales = 0;
  totalRevenue = 0;
  averageTicket = 0;
  chartsLoading = true;

  teste(){
    console.log('totalSales: ' + this.totalSales);
    console.log('totalRevenue: ' + this.totalRevenue);
    console.log('averageTicket: ' + this.averageTicket);
    
  }

  cards: DashboardCard[] = [
    {
      icon: '◎',
      label: 'Vendas',
      description: 'Registrar nova venda',
      route: '/sales',
      highlighted: true,
    },
    {
      icon: '☰',
      label: 'Produtos',
      description: 'Gerenciar catálogo',
      route: '/products',
    },
    {
      icon: '▤',
      label: 'Estoque',
      description: 'Controle de inventário',
      route: '/stock',
    },
    {
      icon: '◈',
      label: 'Caixa',
      description: 'Gerenciar caixa',
      route: '/cash-register',
    },
    {
      icon: '◉',
      label: 'Usuários',
      description: 'Gerenciar equipe',
      route: '/users',
      adminOnly: true,
    },
  ];

  get visibleCards(): DashboardCard[] {
    return this.cards.filter(
      (c) => !c.adminOnly || this.authService.isAdmin()
    );
  }

  constructor(
    protected authService: AuthService,
    private saleService: SaleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSalesData();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.pendingSales) {
      this.renderCharts(this.pendingSales);
      this.pendingSales = null;
    }
  }

  ngOnDestroy(): void {
    this.barChart?.destroy();
    this.pieChart?.destroy();
  }

  private loadSalesData(): void {
    const today = new Date();
    const startDate = this.formatDate(today);
    const endDate = startDate;

    this.saleService.list(startDate, endDate).subscribe({
      next: (sales) => {
        const paidSales = sales.filter((s) => s.status === SaleStatusEnum.PAID);
        this.totalSales = paidSales.length;
        this.totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
        this.averageTicket = this.totalSales > 0 ? this.totalRevenue / this.totalSales : 0;
        this.chartsLoading = false;
        this.cdr.detectChanges();

        if (this.viewReady) {
          this.renderCharts(paidSales);
        } else {
          this.pendingSales = paidSales;
        }

        console.log("sales: ", sales);
        
      },
      error: () => {
        this.chartsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private renderCharts(sales: Sale[]): void {
    // Small timeout to ensure canvas elements are in the DOM after change detection
    setTimeout(() => {
      this.buildBarChart(sales);
      this.buildPieChart(sales);
    }, 0);
  }

  private buildBarChart(sales: Sale[]): void {
    if (!this.barChartCanvas) return;

    const hourlyData = new Array(24).fill(0);
    const hourlyCount = new Array(24).fill(0);

    sales.forEach((sale) => {
      const hour = new Date(sale.closed_at || sale.opened_at).getHours();
      hourlyData[hour] += Number(sale.total_amount);
      hourlyCount[hour]++;
    });

    // Only show hours 6-23 (typical store hours)
    const startHour = 6;
    const endHour = 23;
    const labels = [];
    const revenueData = [];
    const countData = [];

    for (let h = startHour; h <= endHour; h++) {
      labels.push(`${h.toString().padStart(2, '0')}h`);
      revenueData.push(hourlyData[h]);
      countData.push(hourlyCount[h]);
    }

    const ctx = this.barChartCanvas.nativeElement.getContext('2d')!;
    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Faturamento (R$)',
            data: revenueData,
            backgroundColor: 'rgba(224, 93, 83, 0.75)',
            borderColor: '#E05D53',
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: 'y',
          },
          {
            label: 'Nº de Vendas',
            data: countData,
            backgroundColor: 'rgba(101, 154, 118, 0.75)',
            borderColor: '#659A76',
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: "'Nunito', sans-serif", size: 13, weight: 600 },
              color: '#2D2825',
              usePointStyle: true,
              pointStyleWidth: 20,
              padding: 20,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(45, 40, 37, 0.92)',
            titleFont: { family: "'Outfit', sans-serif", size: 14, weight: 600 },
            bodyFont: { family: "'Nunito', sans-serif", size: 13 },
            cornerRadius: 12,
            padding: 14,
            callbacks: {
              label: (context) => {
                if (context.datasetIndex === 0) {
                  return ` R$ ${Number(context.raw).toFixed(2)}`;
                }
                return ` ${context.raw} vendas`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
              color: '#A89F9A',
            },
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(168, 159, 154, 0.12)' },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
              color: '#A89F9A',
              callback: (value) => `R$ ${value}`,
            },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
              color: '#A89F9A',
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  private buildPieChart(sales: Sale[]): void {
    if (!this.pieChartCanvas) return;

    const methodTotals: Record<string, number> = {
      [PaymentMethodEnum.PIX]: 0,
      [PaymentMethodEnum.CARD]: 0,
      [PaymentMethodEnum.CASH]: 0,
    };

    sales.forEach((sale) => {
      sale.payments.forEach((p) => {
        methodTotals[p.method] = (methodTotals[p.method] || 0) + Number(p.amount);
      });
    });

    const methodLabels: Record<string, string> = {
      [PaymentMethodEnum.PIX]: 'PIX',
      [PaymentMethodEnum.CARD]: 'Cartão',
      [PaymentMethodEnum.CASH]: 'Dinheiro',
    };

    const labels = Object.keys(methodTotals).map((k) => methodLabels[k] || k);
    const data = Object.values(methodTotals);
    const hasData = data.some((v) => v > 0);

    const colors = ['#3b82f6', '#E05D53', '#659A76'];
    const borderColors = ['#2563eb', '#c74b42', '#4d7f5c'];

    const ctx = this.pieChartCanvas.nativeElement.getContext('2d')!;
    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? labels : ['Sem dados'],
        datasets: [
          {
            data: hasData ? data : [1],
            backgroundColor: hasData ? colors : ['rgba(168, 159, 154, 0.2)'],
            borderColor: hasData ? borderColors : ['rgba(168, 159, 154, 0.3)'],
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
          legend: {
            position: 'bottom',
            labels: {
              font: { family: "'Nunito', sans-serif", size: 13, weight: 600 },
              color: '#2D2825',
              usePointStyle: true,
              pointStyleWidth: 16,
              padding: 20,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(45, 40, 37, 0.92)',
            titleFont: { family: "'Outfit', sans-serif", size: 14, weight: 600 },
            bodyFont: { family: "'Nunito', sans-serif", size: 13 },
            cornerRadius: 12,
            padding: 14,
            callbacks: {
              label: (context) => {
                if (!hasData) return ' Nenhuma venda registrada';
                const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((Number(context.raw) / total) * 100).toFixed(1) : '0';
                return ` R$ ${Number(context.raw).toFixed(2)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
