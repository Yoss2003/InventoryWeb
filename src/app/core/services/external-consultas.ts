import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SunatRuc { ruc: string; businessName: string; address?: string; estado?: string; condicion?: string; distrito?: string; provincia?: string; departamento?: string; }
export interface ReniecDni {
  document_number?: string;
  first_name?: string;
  first_last_name?: string;
  second_last_name?: string;
}
export interface SupplierContact {
  id: number;
  companyId: number;
  ruc: string;
  businessName: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}
export interface ExchangeRate { id: number; date: string; baseCurrency: string; quoteCurrency: string; buyPrice: number; sellPrice: number; }
@Injectable({providedIn:'root'})
export class ExternalConsultasService {
  private readonly http=inject(HttpClient);
  private readonly base='https://localhost:7295/api';
  // Contratos que utilizaba MAUI: siempre pasar por la API propia; nunca exponer el token Decolecta en Angular.
  ruc(ruc:string){return this.http.get<SunatRuc>(`${this.base}/consultas/ruc/${encodeURIComponent(ruc)}`);}
  dni(dni: string) {
    return this.http.get<ReniecDni>(
      `${this.base}/Customers/dni/${encodeURIComponent(dni)}`
    );
  }
  // Lista interna por empresa; no consume consultas Decolecta.
  suppliers(){return this.http.get<SupplierContact[]>(`${this.base}/Suppliers`);}
  exchangeRate(currency:'USD'|'EUR'){return this.http.get<ExchangeRate>(`${this.base}/ExchangeRates/today/${currency}`);}
  /** Solo historial previamente registrado por la API; no consulta fechas externas. */
  exchangeRatesAll(){return this.http.get<ExchangeRate[]>(`${this.base}/ExchangeRates`);}
}
