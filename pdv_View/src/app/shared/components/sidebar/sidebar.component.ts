import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar">
      <div class="sidebar__logo">
        <span class="logo-icon">◆</span>
        <span class="logo-text">PDV</span>
      </div>

      <nav class="sidebar__nav">
        @for (item of visibleItems; track item.route) {
          <a
            class="nav-item"
            [routerLink]="item.route"
            routerLinkActive="nav-item--active"
            [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
          >
            <span class="nav-item__icon material-icon">{{ item.icon }}</span>
            <span class="nav-item__label">{{ item.label }}</span>
          </a>
        }
      </nav>

      <div class="sidebar__footer">
        <button class="nav-item nav-item--logout" (click)="onLogout()">
          <span class="nav-item__icon">⏻</span>
          <span class="nav-item__label">Sair</span>
        </button>
      </div>
    </aside>
  `,
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  navItems: NavItem[] = [
    { icon: '▦', label: 'Dashboard', route: '/dashboard' },
    { icon: '◎', label: 'Vendas', route: '/sales' },
    { icon: '☰', label: 'Produtos', route: '/products' },
    { icon: '▤', label: 'Estoque', route: '/stock' },
    { icon: '◈', label: 'Caixa', route: '/cash-register' },
    { icon: '◉', label: 'Usuários', route: '/users', adminOnly: true },
  ];

  get visibleItems(): NavItem[] {
    return this.navItems.filter(
      (item) => !item.adminOnly || this.authService.isAdmin()
    );
  }

  constructor(private authService: AuthService) {}

  onLogout(): void {
    this.authService.logout();
    window.location.href = '/login';
  }
}
