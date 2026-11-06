import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const path = req.url.toLowerCase();
  // Estas rutas son públicas: no enviar una sesión anterior al cargar el login.
  if (path.includes('/api/users/login') || path.includes('/api/companies/active')) {
    return next(req);
  }

  const token = inject(AuthService).getToken();
  if (token && token !== 'null') {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
