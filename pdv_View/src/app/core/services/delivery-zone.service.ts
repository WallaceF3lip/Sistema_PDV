import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DeliveryZone, DeliveryZoneCreate, DeliveryZoneUpdate } from '../models';

/** Decimal chega da API como string: converte para number */
const toZone = (z: DeliveryZone): DeliveryZone => ({ ...z, fee: Number(z.fee) });

@Injectable({ providedIn: 'root' })
export class DeliveryZoneService {
  private readonly apiUrl = `${environment.apiUrl}/delivery-zones`;

  constructor(private http: HttpClient) {}

  list(activeOnly: boolean = true): Observable<DeliveryZone[]> {
    return this.http
      .get<DeliveryZone[]>(this.apiUrl, { params: { active_only: activeOnly } })
      .pipe(map((list) => list.map(toZone)));
  }

  create(zone: DeliveryZoneCreate): Observable<DeliveryZone> {
    return this.http.post<DeliveryZone>(this.apiUrl, zone).pipe(map(toZone));
  }

  update(id: number, zone: DeliveryZoneUpdate): Observable<DeliveryZone> {
    return this.http.patch<DeliveryZone>(`${this.apiUrl}/${id}`, zone).pipe(map(toZone));
  }

  /** Exclusão lógica (somente ADMIN) */
  deactivate(id: number): Observable<DeliveryZone> {
    return this.http.delete<DeliveryZone>(`${this.apiUrl}/${id}`).pipe(map(toZone));
  }
}
