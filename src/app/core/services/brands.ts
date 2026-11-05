import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';
import { Brand, CreateBrandRequest } from '../models/brand.model';

@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:7295/api/Brands';
  private brandsCache$?: Observable<Brand[]>;

  getBrands(refresh = false): Observable<Brand[]> {
    if (refresh || !this.brandsCache$) {
      this.brandsCache$ = this.http.get<Brand[]>(this.apiUrl).pipe(
        catchError(error => {
          this.brandsCache$ = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.brandsCache$;
  }

  invalidateCache(): void { this.brandsCache$ = undefined; }

  createBrand(data: CreateBrandRequest): Observable<Brand> {
    return this.http.post<Brand>(this.apiUrl, {
      inventoryId: data.inventoryId,
      categoryId: data.categoryId,
      name: data.name.trim(),
      isActive: true,
      isSynced: false
    }).pipe(tap(() => this.invalidateCache()));
  }
}
