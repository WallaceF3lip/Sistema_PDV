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
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  isAdmin = false;

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
      (item) => !item.adminOnly || this.isAdmin
    );
  }

  constructor(private authService: AuthService) {
    this.authService.isAdmin$.subscribe((admin) => {
      this.isAdmin = admin;
    });
  }

  onLogout(): void {
    this.authService.logout();
    window.location.href = '/login';
  }
}
