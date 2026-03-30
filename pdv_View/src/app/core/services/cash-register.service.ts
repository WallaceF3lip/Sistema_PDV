import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CashRegister,
  CashRegisterOpen,
  CashRegisterClose,
  CashMovementCreate,
  CashMovement,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  private readonly apiUrl = `${environment.apiUrl}/cash-registers`;

  constructor(private http: HttpClient) {}

  open(payload: CashRegisterOpen): Observable<CashRegister> {
    return this.http.post<CashRegister>(this.apiUrl, payload);
  }

  getMyOpen(): Observable<CashRegister> {
    return this.http.get<CashRegister>(`${this.apiUrl}/my-open`);
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
