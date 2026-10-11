import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { PrintRootComponent } from './shared/components/print-root/print-root.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, PrintRootComponent],
  template: `
    <router-outlet />
    <app-toast />
    <app-print-root />
  `,
  styles: [],
})
export class AppComponent {}
