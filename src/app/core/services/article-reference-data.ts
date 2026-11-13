import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ArticleSupplierReference {
  id: number;
  inventoryId?: number;
  companyId?: number;
  ruc: string;
  businessName: string;
  isActive: boolean;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  statusId?: number;
  estado?: string | null;
  condicion?: string | null;
  distrito?: string | null;
  provincia?: string | null;
  departamento?: string | null;
  relationshipDescription?: string | null;
  fiscalDataJson?: string | null;
  reused?: boolean;
}

export interface ArticleParameterReference {
  id: number;
  inventoryId: number;
  companyId: number;
  parameterType: string;
  name: string;
  description?: string | null;
}

export interface CurrencyReference {
  id: number;
  currencyCode: string | null;
  currencyName: string;
}

export interface ExchangeRateReference {
  id: number;
  baseCurrency: string;
  quoteCurrency: string;
  buyPrice: number;
  sellPrice: number;
  date: string;
}

/** Catálogos de referencia del formulario de artículos. */
@Injectable({ providedIn: 'root' })
export class ArticleReferenceDataService {
  private readonly http = inject(HttpClient);
  private readonly api = 'https://localhost:7295/api';

  suppliers(): Observable<ArticleSupplierReference[]> {
    return this.http.get<ArticleSupplierReference[]>(`${this.api}/Suppliers`);
  }

  lookupSupplierRuc(ruc: string): Observable<Partial<ArticleSupplierReference>> {
    return this.http.get<Partial<ArticleSupplierReference>>(
      `${this.api}/Suppliers/ruc/${encodeURIComponent(ruc)}`
    );
  }

  createSupplier(input: Partial<ArticleSupplierReference> & { inventoryId: number }): Observable<ArticleSupplierReference> {
    return this.http.post<ArticleSupplierReference>(`${this.api}/Suppliers`, input);
  }

  updateSupplier(id: number, input: Partial<ArticleSupplierReference>): Observable<void> {
    return this.http.put<void>(`${this.api}/Suppliers/${id}`, input);
  }

  parameters(): Observable<ArticleParameterReference[]> {
    return this.http.get<ArticleParameterReference[]>(`${this.api}/Parameters`);
  }

  currencies(): Observable<CurrencyReference[]> {
    return this.http.get<CurrencyReference[]>(`${this.api}/Currencies`);
  }

  todayExchangeRate(currency: 'USD' | 'EUR'): Observable<ExchangeRateReference> {
    return this.http.get<ExchangeRateReference>(`${this.api}/ExchangeRates/today/${currency}`);
  }
}
