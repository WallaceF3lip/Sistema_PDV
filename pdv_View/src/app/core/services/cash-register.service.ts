import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CashRegister,
  CashRegisterOpen,
  CashRegisterClose,
  CashMovementCreate,
  CashMovement,
  CashRegisterSummary,
  CashRegisterPage,
  CashRegisterListParams,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  private readonly apiUrl = `${environment.apiUrl}/cash-registers`;

  constructor(private http: HttpClient) {}

  open(payload: CashRegisterOpen): Observable<CashRegister> {
    return this.http.post<CashRegister>(this.apiUrl, payload);
  }

  /** Caixa único aberto do estabelecimento, ou null (sem erro) */
  getCurrent(): Observable<CashRegister | null> {
    return this.http.get<CashRegister | null>(`${this.apiUrl}/current`);
  }

  /** Histórico paginado (ADMIN) */
  list(params: CashRegisterListParams = {}): Observable<CashRegisterPage> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<CashRegisterPage>(`${this.apiUrl}/`, { params: httpParams });
  }

  getSummary(registerId: number): Observable<CashRegisterSummary> {
    return this.http.get<CashRegisterSummary>(`${this.apiUrl}/${registerId}/summary`);
  }

  getById(id: number): Observable<CashRegister> {
    return this.http.get<CashRegister>(`${this.apiUrl}/${id}`);
  }

  listMovements(registerId: number): Observable<CashMovement[]> {
    return this.http.get<CashMovement[]>(`${this.apiUrl}/${registerId}/movements`);
  }

  createSangria(registerId: number, payload: CashMovementCreate): Observable<CashMovement> {
    return this.http.post<CashMovement>(`${this.apiUrl}/${registerId}/sangria`, payload);
  }

  createSuprimento(registerId: number, payload: CashMovementCreate): Observable<CashMovement> {
    return this.http.post<CashMovement>(`${this.apiUrl}/${registerId}/suprimento`, payload);
  }

  close(registerId: number, payload: CashRegisterClose): Observable<CashRegister> {
    return this.http.post<CashRegister>(`${this.apiUrl}/${registerId}/close`, payload);
  }
}
