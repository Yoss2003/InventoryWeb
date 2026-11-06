import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LoginRequest, AuthResponse } from '../models/auth.model';
import { tap } from 'rxjs';

/** La API puede pedir cambio inicial de contraseña en lugar de emitir un token. */
export type LoginApiResult = AuthResponse | {
  requirePasswordChange: true;
  user?: { id: number; companyId?: number };
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = 'https://localhost:7295/api/Users';
  private readonly companyPreference = 'inventory-last-company-id';

  login(credentials: LoginRequest) {
    return this.http.post<LoginApiResult>(`${this.apiUrl}/Login`, credentials).pipe(
      tap(result => {
        if (!('token' in result) || !result.token) return;
        // El token siempre debe pertenecer a la empresa que eligió el usuario.
        if (Number(result.companyId) !== Number(credentials.companyId)) {
          throw new Error('La empresa de la sesión no coincide con la seleccionada. Acceso rechazado.');
        }
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('token', result.token);
          localStorage.setItem('userSession', JSON.stringify(result));
          localStorage.setItem(this.companyPreference, String(credentials.companyId));
        }
      })
    );
  }

  getLastSelectedCompanyId(): number | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const value = Number(localStorage.getItem(this.companyPreference));
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('token');
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem('token');
    localStorage.removeItem('userSession');
    // Se conserva solo la preferencia de empresa; nunca la contraseña.
  }
}
