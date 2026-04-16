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
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  isAdmin = false;

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
      (c) => !c.adminOnly || this.isAdmin
    );
  }

  constructor(private authService: AuthService) {
    this.authService.isAdmin$.subscribe((admin) => {
      this.isAdmin = admin;
    });
  }
}
