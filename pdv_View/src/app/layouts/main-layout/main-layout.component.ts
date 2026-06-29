import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
// import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="layout">
      <app-sidebar #sidebar />
      <main class="layout__main">
        <!-- Mobile header with hamburger -->
        <div class="layout__mobile-header">
          <button class="hamburger-btn" (click)="sidebar.toggle()" aria-label="Menu">
            <span class="hamburger-btn__line"></span>
            <span class="hamburger-btn__line"></span>
            <span class="hamburger-btn__line"></span>
          </button>
          <span class="layout__mobile-logo">◆ PDV</span>
        </div>
        <div class="layout__content animate-fade-in">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styleUrl: './main-layout.scss',
})
export class MainLayoutComponent {
  @ViewChild('sidebar') sidebar!: SidebarComponent;
}
