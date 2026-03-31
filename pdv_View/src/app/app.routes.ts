import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

import { LoginComponent } from './pages/login/login.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProductsComponent } from './pages/products/products.component';
import { StockComponent } from './pages/stock/stock.component';
import { CashRegisterComponent } from './pages/cash-register/cash-register.component';
import { UsersComponent } from './pages/users/users.component';
import { SalesComponent } from './pages/sales/sales.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'stock', component: StockComponent },
      { path: 'cash-register', component: CashRegisterComponent },
      { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
      { path: 'sales', component: SalesComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
