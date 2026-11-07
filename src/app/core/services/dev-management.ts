import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type LicensePlan = 'Pro' | 'Plus' | 'Max';

export interface RucLookupResult {
  ruc: string;
  businessName: string;
  address: string;
  estado: string;
  condicion: string;
  source: string;
}


export interface CompanyLicenseInfo {
  plan: string; // Los registros anteriores pueden tener planes históricos.
  maxUsers: number;
  startsAt: string | null;
  expiresAt: string;
  isEnabled: boolean;
}

export interface DevCompany {
  id: number;
  businessName: string;
  ruc: string;
  fiscalOwnerName: string | null;
  contactEmail: string | null;
  isActive: boolean;
  logoUrl: string | null;
  primaryColorHex: string | null;
  userCount: number; // Cálculo de la API: nunca se envía al guardar.
  totalUsers: number;
  inventoryCount: number;
  license: CompanyLicenseInfo | null;
}

/** Contrato de escritura de la API Fase 2.1: no se envía la fecha de vencimiento. */
export interface CompanyEdit {
  businessName: string;
  ruc: string;
  fiscalOwnerName: string | null;
  contactEmail: string | null;
  plan: string;
  maxUsers: number;
  licenseEnabled: boolean;
  primaryColorHex: string | null;
  logoUrl: string | null;
}

export interface RenewLicenseInput {
  plan: LicensePlan;
  maxUsers: number;
}

export interface ResetPending {
  id: number;
  companyId: number;
  userId: number;
  username: string;
  company: string;
  requestedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DevManagementService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://localhost:7295/api';

  list() { return this.http.get<DevCompany[]>(`${this.base}/dev/companies`); }
  lookupRuc(ruc: string) {
    return this.http.get<RucLookupResult>(`${this.base}/dev/companies/lookup-ruc/${encodeURIComponent(ruc)}`);
  }
  uploadLogo(companyId: number, image: File) {
    const body = new FormData();
    body.append('file', image, image.name);
    return this.http.post<{ logoUrl: string }>(`${this.base}/company-logos/${companyId}`, body);
  }
  create(body: CompanyEdit) { return this.http.post<{ id: number }>(`${this.base}/dev/companies`, body); }
  update(id: number, body: CompanyEdit) { return this.http.put<void>(`${this.base}/dev/companies/${id}`, body); }
  renewLicense(id: number, body: RenewLicenseInput) {
    return this.http.post<CompanyLicenseInfo>(`${this.base}/dev/companies/${id}/renew-license`, body);
  }
  deactivate(id: number) { return this.http.delete<void>(`${this.base}/dev/companies/${id}`); }
  pending() { return this.http.get<ResetPending[]>(`${this.base}/password-recovery/pending`); }
  approve(id: number) { return this.http.post<{ message: string }>(`${this.base}/password-recovery/${id}/approve`, {}); }
  reject(id: number) { return this.http.post<void>(`${this.base}/password-recovery/${id}/reject`, {}); }
}
