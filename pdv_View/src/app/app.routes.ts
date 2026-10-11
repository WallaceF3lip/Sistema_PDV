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
import { SalesHistoryComponent } from './pages/sales-history/sales-history.component';
import { CustomersComponent } from './pages/customers/customers.component';
import { DeliveryZonesComponent } from './pages/delivery-zones/delivery-zones.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { ReportsComponent } from './pages/reports/reports.component';

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
      { path: 'orders', component: OrdersComponent },
      { path: 'sales-history', component: SalesHistoryComponent },
      { path: 'customers', component: CustomersComponent },
      { path: 'delivery-zones', component: DeliveryZonesComponent, canActivate: [adminGuard] },
      { path: 'reports', component: ReportsComponent, canActivate: [adminGuard] },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
