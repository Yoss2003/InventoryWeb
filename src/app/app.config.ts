import { ApplicationConfig } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, of } from 'rxjs';
import { ToastService } from './shared/toast/toast.service';
import type { ToastType } from './shared/toast/toast.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';

// /* FASE 4.1 */
// Puente de compatibilidad: las vistas antiguas que usaban MatSnackBar
// publican exactamente el mismo toast que las vistas nuevas.
function snackBarAsToast(toasts: ToastService): MatSnackBar {
  return {
    open(message: string, _action?: string, options?: { duration?: number }) {
      const text = String(message ?? '');
      const type: ToastType = /error|fall[oó]|no se pud|rechazad|inv[aá]lid|no se encontr[oó]|sin permiso|no tienes permiso|insuficiente/i.test(text)
        ? 'error'
        : /revisa|selecciona|completa|primero|debes|atenci[oó]n|no se detect[oó]|necesita/i.test(text)
          ? 'warning' : 'success';
      const title = type === 'error' ? 'No se pudo completar' : type === 'warning' ? 'Atención' : 'Operación realizada';
      const id = toasts.show(text, type, title, options?.duration ?? (type === 'error' ? 8000 : 4500));
      return {
        dismiss: () => toasts.dismiss(id),
        dismissWithAction: () => toasts.dismiss(id),
        afterDismissed: () => of({ dismissedByAction: false }),
        onAction: () => EMPTY
      };
    },
    dismiss: () => undefined
  } as unknown as MatSnackBar;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimationsAsync(),
    { provide: MatSnackBar, useFactory: snackBarAsToast, deps: [ToastService] }
  ]
};