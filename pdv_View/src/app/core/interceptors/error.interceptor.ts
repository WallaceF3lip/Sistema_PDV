import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'Erro desconhecido';

      if (error.error?.detail) {
        message = error.error.detail;
      } else if (error.status === 0) {
        message = 'Sem conexão com o servidor';
      } else if (error.status === 401) {
        message = 'Sessão expirada. Faça login novamente.';
        // Não fazer logout/redirect se a requisição for /auth/me
        // pois o loadUser() do AuthService já trata esse cenário
        const isAuthMeRequest = req.url.includes('/auth/me');
        if (!isAuthMeRequest) {
          auth.logout();
          router.navigate(['/login']);
        }
      } else if (error.status === 403) {
        message = 'Acesso negado';
      } else if (error.status === 404) {
        message = 'Recurso não encontrado';
      } else if (error.status === 409) {
        message = error.error?.detail || 'Conflito de dados';
      } else if (error.status >= 500) {
        message = 'Erro interno do servidor';
      }

      toast.error(message);
      return throwError(() => error);
    })
  );
};
