import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// APP_INITIALIZER garante que o /auth/me já foi resolvido antes desta guard rodar.
// Portanto, a verificação é sempre síncrona e confiável.
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.isAdmin()) return true;

  router.navigate(['/dashboard']);
  return false;
};



