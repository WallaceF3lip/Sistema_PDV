import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
  template: `
    <div class="dashboard">
      <div class="dashboard__intro animate-slide-up">
        <h2 class="display-md">Painel de Controle</h2>
        <p class="body-lg text-muted">
          Selecione uma ação para começar a gerenciar.
        </p>
      </div>

      <div class="dashboard__grid">
        @for (card of visibleCards; track card.route; let i = $index) {
          <a
            class="dashboard-card card animate-slide-up"
            [class.dashboard-card--highlighted]="card.highlighted"
            [routerLink]="card.route"
            [style.animation-delay]="(i * 60) + 'ms'"
          >
            <span class="dashboard-card__icon">{{ card.icon }}</span>
            <span class="dashboard-card__label headline-md">{{ card.label }}</span>
            <span class="dashboard-card__desc body-sm text-muted">{{ card.description }}</span>
          </a>
        }
      </div>
    </div>
  `,
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
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

  constructor(private authService: AuthService) {}
}
