import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Article } from '../models/article.model';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private http = inject(HttpClient);
  private apiUrl = 'https://localhost:7295/api/Articles';

  getArticles(): Observable<Article[]> {
    return this.http.get<Article[]>(this.apiUrl);
  }
}