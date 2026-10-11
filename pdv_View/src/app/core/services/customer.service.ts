import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Customer,
  CustomerAddress,
  CustomerAddressCreate,
  CustomerAddressUpdate,
  CustomerCreate,
  CustomerUpdate,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly apiUrl = `${environment.apiUrl}/customers`;

  constructor(private http: HttpClient) {}

  /** Busca por nome ou telefone */
  search(q: string, activeOnly: boolean = true, limit: number = 10): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.apiUrl, {
      params: { q, active_only: activeOnly, limit },
    });
  }

  list(activeOnly: boolean = true, limit: number = 200): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.apiUrl, {
      params: { active_only: activeOnly, limit },
    });
  }

  getById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/${id}`);
  }

  create(customer: CustomerCreate): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl, customer);
  }

  update(id: number, customer: CustomerUpdate): Observable<Customer> {
    return this.http.patch<Customer>(`${this.apiUrl}/${id}`, customer);
  }

  /** Exclusão lógica (somente ADMIN) */
  deactivate(id: number): Observable<Customer> {
    return this.http.delete<Customer>(`${this.apiUrl}/${id}`);
  }

  addAddress(customerId: number, address: CustomerAddressCreate): Observable<CustomerAddress> {
    return this.http.post<CustomerAddress>(`${this.apiUrl}/${customerId}/addresses`, address);
  }

  updateAddress(
    customerId: number,
    addressId: number,
    address: CustomerAddressUpdate
  ): Observable<CustomerAddress> {
    return this.http.patch<CustomerAddress>(
      `${this.apiUrl}/${customerId}/addresses/${addressId}`,
      address
    );
  }

  removeAddress(customerId: number, addressId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${customerId}/addresses/${addressId}`);
  }
}
