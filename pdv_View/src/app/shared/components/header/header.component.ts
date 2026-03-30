import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header">
      <div class="header__left">
        <h1 class="header__title headline-md">{{ pageTitle }}</h1>
      </div>
      <div class="header__right">
        @if (user) {
          <div class="header__user">
            <div class="header__avatar">
              {{ user.name.charAt(0).toUpperCase() }}
            </div>
            <div class="header__info">
              <span class="header__name body-md">{{ user.name }}</span>
              <span class="header__role label-sm">{{ user.role }}</span>
            </div>
          </div>
        }
      </div>
    </header>
  `,
  styleUrl: './header.scss',
})
export class HeaderComponent {
  pageTitle = '';

  get user() {
    return this.authService.getCurrentUser();
  }

  constructor(private authService: AuthService) {}
}
