import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/dashboard']);
    return false;
  }

  // Aguarda o usuário ser carregado do /auth/me antes de verificar a role
  return authService.currentUser$.pipe(
    filter((user) => user !== null),
    take(1),
    map((user) => {
      if (user?.role === 'ADMIN') {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
