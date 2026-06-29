import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  template: `
    <div class="layout">
      <app-sidebar />
      <main class="layout__main"><br>
        <!-- <app-header /> -->
        <div class="layout__content animate-fade-in">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styleUrl: './main-layout.scss',
})
export class MainLayoutComponent {}
