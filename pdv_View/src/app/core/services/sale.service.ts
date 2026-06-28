import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Sale, AddItemRequest, FinalizeSaleRequest } from '../models';

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

  list(startDate: string, endDate: string): Observable<Sale[]> {
    return this.http.get<Sale[]>(this.apiUrl, {
      params: { start_date: startDate, end_date: endDate },
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

  cancel(saleId: number): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/${saleId}/cancel`, {});
  }
}
