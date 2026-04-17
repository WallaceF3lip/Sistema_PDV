import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, switchMap, map, catchError, of, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenResponse, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  // Signal central: única fonte de verdade para o usuário autenticado.
  // Todos os componentes leem daqui — sem subscriptions locais.
  readonly currentUser = signal<User | null>(null);

  // Signal derivado: isAdmin é automaticamente recalculado quando currentUser muda.
  // Componentes usam authService.isAdmin() — Angular detecta a mudança automaticamente.
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  constructor(private http: HttpClient) {}

  /**
   * Chamado pelo APP_INITIALIZER antes de qualquer rota ser ativada.
   * Garante que o usuário está carregado na memória ao iniciar (login e refresh).
   */
  initialize(): Promise<void> {
    if (!this.getToken()) return Promise.resolve();
    return firstValueFrom(this.fetchCurrentUser()).then(() => undefined);
  }

  /**
   * Busca /auth/me e atualiza o signal central.
   * Retorna Observable para permitir encadeamento no login().
   */
  private fetchCurrentUser(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => this.currentUser.set(user)),
      catchError(() => {
        // Apenas limpar o usuário, sem remover o token.
        // Se o token for realmente inválido, as próximas
        // requisições receberão 401 e o interceptor tratará.
        this.currentUser.set(null);
        return of(null);
      })
    );
  }

  /**
   * Faz login e aguarda o /auth/me completar antes de emitir.
   * Garante que isAdmin já está correto quando o componente navega.
   */
  login(email: string, password: string): Observable<TokenResponse> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/token`, body.toString(), { headers })
      .pipe(
        tap((res) => localStorage.setItem('access_token', res.access_token)),
        switchMap((tokenRes) =>
          this.fetchCurrentUser().pipe(map(() => tokenRes))
        )
      );
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  logout(): void {
    localStorage.removeItem('access_token');
    this.currentUser.set(null);
  }
}

