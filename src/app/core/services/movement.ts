import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Movement } from '../models/movement.model';

@Injectable({ providedIn: 'root' })
export class MovementService {
  private http = inject(HttpClient);
  private apiUrl = 'https://localhost:7295/api/Movements';

  getMovements(): Observable<Movement[]> {
    return this.http.get<Movement[]>(this.apiUrl);
  }
  
  createMovement(movement: Movement): Observable<Movement> {
    return this.http.post<Movement>(this.apiUrl, movement);
  }
}