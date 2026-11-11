import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SunatRuc { ruc: string; businessName: string; address?: string; estado?: string; condicion?: string; distrito?: string; provincia?: string; departamento?: string; }
export interface RegisteredSupplier {
  id: number;
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
  /** Proveedores registrados en la empresa del usuario; no consulta Decolecta. */
  suppliers(){return this.http.get<RegisteredSupplier[]>(`${this.base}/Suppliers`);}
  ruc(ruc:string){return this.http.get<SunatRuc>(`${this.base}/consultas/ruc/${encodeURIComponent(ruc)}`);}
  exchangeRate(currency:'USD'|'EUR'){return this.http.get<ExchangeRate>(`${this.base}/ExchangeRates/today/${currency}`);}
  /** Solo historial previamente registrado por la API; no consulta fechas externas. */
  exchangeRatesAll(){return this.http.get<ExchangeRate[]>(`${this.base}/ExchangeRates`);}
}
