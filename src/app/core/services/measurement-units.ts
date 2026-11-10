
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MeasurementUnit {
  id: number;
  unitName: string;
  abbreviation: string;
}

@Injectable({ providedIn: 'root' })
export class MeasurementUnitsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:7295/api/MeasurementUnits';

  getAll(): Observable<MeasurementUnit[]> {
    return this.http.get<MeasurementUnit[]>(this.apiUrl);
  }
}