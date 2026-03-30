import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card animate-scale-in" [class.shake]="hasError">
        <div class="login-card__header">
          <span class="login-logo">◆</span>
          <h1 class="login-title">PDV</h1>
          <p class="login-subtitle body-md text-muted">Acesso ao Terminal</p>
        </div>

        <form class="login-card__form" (ngSubmit)="onLogin()">
          <div class="form-group">
            <label class="label-sm text-muted" for="email">E-MAIL</label>
            <input
              id="email"
              class="input-field"
              type="email"
              placeholder="seu@email.com"
              [(ngModel)]="email"
              name="email"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label class="label-sm text-muted" for="password">SENHA</label>
            <input
              id="password"
              class="input-field"
              type="password"
              placeholder="••••••••"
              [(ngModel)]="password"
              name="password"
              required
              autocomplete="current-password"
            />
          </div>

          @if (errorMessage) {
            <p class="login-error body-sm animate-fade-in">{{ errorMessage }}</p>
          }

          <button
            type="submit"
            class="btn btn-primary btn-lg btn-block"
            [disabled]="isLoading"
          >
            @if (isLoading) {
              <span class="spinner"></span>
            } @else {
              Acessar
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styleUrl: './login.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  hasError = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onLogin(): void {
    if (!this.email || !this.password) return;

    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage = err.error?.detail || 'Credenciais inválidas';

        setTimeout(() => (this.hasError = false), 600);
      },
    });
  }
}
