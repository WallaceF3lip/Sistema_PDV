import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Stock, StockAdjust, StockMovement } from '../models';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly apiUrl = `${environment.apiUrl}/stock`;

  constructor(private http: HttpClient) {}

  list(): Observable<Stock[]> {
    return this.http.get<Stock[]>(this.apiUrl);
  }

  getByProductId(productId: number): Observable<Stock> {
    return this.http.get<Stock>(`${this.apiUrl}/product/${productId}`);
  }

  stockIn(productId: number, adjust: StockAdjust): Observable<Stock> {
    return this.http.post<Stock>(`${this.apiUrl}/product/${productId}/in`, adjust);
  }

  adjust(productId: number, adjust: StockAdjust): Observable<Stock> {
    return this.http.post<Stock>(`${this.apiUrl}/product/${productId}/adjust`, adjust);
  }

  listMovements(productId?: number, limit: number = 100): Observable<StockMovement[]> {
    const params: any = { limit };
    if (productId) params.product_id = productId;
    return this.http.get<StockMovement[]>(`${this.apiUrl}/movements`, { params });
  }
}
