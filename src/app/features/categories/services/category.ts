import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';
import { Category } from '../../../core/models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:7295/api/Categories';
  private categoriesCache$?: Observable<Category[]>;

  getCategories(refresh = false): Observable<Category[]> {
    if (refresh || !this.categoriesCache$) {
      this.categoriesCache$ = this.http.get<Category[]>(this.apiUrl).pipe(
        catchError(error => {
          this.categoriesCache$ = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.categoriesCache$;
  }

  refreshCategories(): Observable<Category[]> { return this.getCategories(true); }
  invalidateCache(): void { this.categoriesCache$ = undefined; }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, category).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
