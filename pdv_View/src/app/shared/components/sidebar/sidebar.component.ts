import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs/operators';

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
  isOpen = false;

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

  get user() {
    return this.authService.getCurrentUser();
  }

  constructor(protected authService: AuthService, private router: Router) {
    // Close sidebar on route change (mobile)
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.isOpen = false;
      });
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }

  onLogout(): void {
    this.authService.logout();
    window.location.href = '/login';
  }

  @HostListener('window:resize')
  onResize(): void {
    // Auto-close sidebar when resizing above breakpoint
    if (window.innerWidth >= 1024) {
      this.isOpen = false;
    }
  }
}
