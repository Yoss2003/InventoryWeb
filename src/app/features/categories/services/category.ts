import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../../../core/models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);
  private apiUrl = 'https://localhost:7295/api/Categories';

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  // NUEVO MÉTODO POST
  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, category);
  }
}