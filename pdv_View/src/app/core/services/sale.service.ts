import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Sale,
  AddItemRequest,
  FinalizeSaleRequest,
  UpdateOrderDetailsRequest,
  SettleSaleRequest,
  SalesBoard,
  SaleListFilters,
} from '../models';
import { SILENT_ERROR } from '../interceptors/silent-error.token';

/** Opções de requisição: silent = sem toast do interceptor */
export interface SaleRequestOptions {
  silent?: boolean;
}

function requestContext(opts?: SaleRequestOptions): HttpContext {
  return new HttpContext().set(SILENT_ERROR, !!opts?.silent);
}

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly apiUrl = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) {}

  openSale(): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl, {});
  }

  getCurrent(): Observable<Sale | null> {
    return this.http.get<Sale | null>(`${this.apiUrl}/current`);
  }

  getById(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/${id}`);
  }

  list(startDate: string, endDate: string, filters?: SaleListFilters): Observable<Sale[]> {
    let params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.order_type) params = params.set('order_type', filters.order_type);
    return this.http.get<Sale[]>(this.apiUrl, { params });
  }

  /** Quadro do dia de operação (`date` YYYY-MM-DD; padrão: dia atual no servidor) */
  getBoard(date?: string, opts?: SaleRequestOptions): Observable<SalesBoard> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<SalesBoard>(`${this.apiUrl}/board`, {
      params,
      context: requestContext(opts),
    });
  }

  /** Quita um pedido PENDING (POST /sales/{id}/settle) */
  settle(saleId: number, request: SettleSaleRequest, opts?: SaleRequestOptions): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/${saleId}/settle`, request, {
      context: requestContext(opts),
    });
  }

  addItem(saleId: number, item: AddItemRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/${saleId}/items`, item);
  }

  updateItem(saleId: number, itemId: number, quantity: number): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/${saleId}/items/${itemId}`, { quantity });
  }

  removeItem(saleId: number, itemId: number): Observable<Sale> {
    return this.http.delete<Sale>(`${this.apiUrl}/${saleId}/items/${itemId}`);
  }

  finalize(saleId: number, request: FinalizeSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/${saleId}/finalize`, request);
  }

  updateOrderDetails(saleId: number, payload: UpdateOrderDetailsRequest): Observable<Sale> {
    return this.http.patch<Sale>(`${this.apiUrl}/${saleId}/order-details`, payload);
  }

  cancel(saleId: number, opts?: SaleRequestOptions): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/${saleId}/cancel`, {}, {
      context: requestContext(opts),
    });
  }
}
