import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalesSummary, TopProductsOrder } from '../models';

export interface SalesSummaryOptions {
  topLimit?: number;
  topBy?: TopProductsOrder;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  /** Resumo de vendas do período (datas YYYY-MM-DD, intervalo inclusivo). Somente ADMIN. */
  getSalesSummary(
    startDate: string,
    endDate: string,
    opts: SalesSummaryOptions = {}
  ): Observable<SalesSummary> {
    let params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    if (opts.topLimit != null) params = params.set('top_limit', opts.topLimit);
    if (opts.topBy) params = params.set('top_by', opts.topBy);
    return this.http.get<SalesSummary>(`${this.apiUrl}/sales-summary`, { params });
  }
}
