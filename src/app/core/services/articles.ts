import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Article } from '../models/article.model';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:7295/api/Articles';

  getArticles(): Observable<Article[]> {
    return this.http.get<Article[]>(this.apiUrl);
  }

  getArticle(id: number): Observable<Article> {
    return this.http.get<Article>(`${this.apiUrl}/${id}`);
  }

  createArticle(article: Partial<Article>): Observable<Article> {
    return this.http.post<Article>(this.apiUrl, article);
  }

  updateArticle(article: Partial<Article> & { id: number }): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${article.id}`, article);
  }

  deleteArticle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadMedia(id: number, photo?: File | null, voucher?: File | null): Observable<void> {
    const form = new FormData();
    if (photo) form.append('photo', photo, photo.name);
    if (voucher) form.append('voucher', voucher, voucher.name);
    return this.http.post<void>(`${this.apiUrl}/${id}/media`, form);
  }

  deleteMedia(id: number, kind: 'photo' | 'voucher'): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/media/${kind}`);
  }

  getMedia(id: number, kind: 'photo' | 'voucher'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/media/${kind}`, { responseType: 'blob' });
  }
}
