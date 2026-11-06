import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface CompanyLicenseInfo { plan: string; maxUsers: number; expiresAt: string; isEnabled: boolean; }
export interface DevCompany {
  id: number; businessName: string; ruc: string; isActive: boolean;
  logoUrl: string | null; primaryColorHex: string | null;
  userCount: number; totalUsers: number; inventoryCount: number;
  license: CompanyLicenseInfo | null;
}
export interface CompanyEdit {
  businessName: string; ruc: string; plan: string; maxUsers: number; expiresAt: string;
  licenseEnabled: boolean; primaryColorHex: string | null; logoUrl: string | null;
}
export interface ResetPending {
  id: number; companyId: number; userId: number; username: string; company: string; requestedAt: string;
}
@Injectable({ providedIn: 'root' })
export class DevManagementService {
  private http = inject(HttpClient);
  private base = 'https://localhost:7295/api';
  list() { return this.http.get<DevCompany[]>(`${this.base}/dev/companies`); }
  create(body: CompanyEdit) { return this.http.post<{id:number}>(`${this.base}/dev/companies`, body); }
  update(id: number, body: CompanyEdit) { return this.http.put<void>(`${this.base}/dev/companies/${id}`, body); }
  deactivate(id: number) { return this.http.delete<void>(`${this.base}/dev/companies/${id}`); }
  pending() { return this.http.get<ResetPending[]>(`${this.base}/password-recovery/pending`); }
  approve(id: number) { return this.http.post<{message:string}>(`${this.base}/password-recovery/${id}/approve`, {}); }
  reject(id: number) { return this.http.post<void>(`${this.base}/password-recovery/${id}/reject`, {}); }
}
