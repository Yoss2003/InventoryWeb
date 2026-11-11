import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AccessService } from '../services/access';

/** Solo UX. La autorización real se hace siempre en la API. */
export const permissionGuard: CanActivateFn = (route) => {
  const service = inject(AccessService);
  const router = inject(Router);
  const required = String(route.data?.['permission'] || '');
  const devOnly = route.data?.['developerOnly'] === true;
  return service.me().pipe(
    map(access => (
      (!devOnly || access.isDeveloper) &&
      (!required || (access.permissions || []).includes(required))
    ) ? true : router.parseUrl('/dashboard/articulos')),
    catchError(() => of(router.parseUrl('/dashboard/articulos')))
  );
};
