import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AccessSnapshot {
  userId: number;
  companyId: number;
  roleId: number;
  isDeveloper: boolean;
  isAdministrator: boolean;
  permissions: string[];
  masterInventoryId: number | null;
}

@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly http = inject(HttpClient);
  private readonly url = 'https://localhost:7295/api/Access/me';

  me() { return this.http.get<AccessSnapshot>(this.url); }
}
