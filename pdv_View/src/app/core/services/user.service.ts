import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserCreate, UserUpdate } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  create(user: UserCreate): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  update(id: number, user: UserUpdate): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, user);
  }

  toggleActive(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-active`, {});
  }
}
