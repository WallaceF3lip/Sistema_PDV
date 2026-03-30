import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

import { LoginComponent } from './features/login/login.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProductsComponent } from './features/products/products.component';
import { StockComponent } from './features/stock/stock.component';
import { CashRegisterComponent } from './features/cash-register/cash-register.component';
import { UsersComponent } from './features/users/users.component';
import { SalesComponent } from './features/sales/sales.component';

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
