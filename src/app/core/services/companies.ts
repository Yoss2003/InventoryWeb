import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CompanyPublic } from '../models/company-public.model';

@Injectable({ providedIn: 'root' })
export class CompanyPublicService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'https://localhost:7295';

  /** Endpoint público que filtra las empresas activas en la API. */
  getActiveCompanies(): Observable<CompanyPublic[]> {
    return this.http.get<CompanyPublic[]>(`${this.apiBaseUrl}/api/Companies/Active`).pipe(
      map(companies => (Array.isArray(companies) ? companies : [])
        .filter(company => Number(company.id) > 0 && !!company.businessName?.trim())
        .sort((a, b) => a.businessName.localeCompare(b.businessName, 'es')))
    );
  }

  /** Admite logos absolutos o rutas servidas por la API. */
  publicLogoUrl(path: string | null | undefined): string | null {
    const value = (path ?? '').trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    if (/^\/{1}(?!\/)/.test(value)) return `${this.apiBaseUrl}${value}`;
    if (/^[a-z0-9][a-z0-9/_\-.]*$/i.test(value) && !value.includes('..')) {
      return `${this.apiBaseUrl}/${value}`;
    }
    return null;
  }
}
