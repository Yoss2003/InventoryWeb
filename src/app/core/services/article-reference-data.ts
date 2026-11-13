import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ArticleSupplierReference {
  id: number;
  ruc: string;
  businessName: string;
  isActive: boolean;
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
