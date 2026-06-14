import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LoginService } from './login.service';
import { map, skipWhile, take } from 'rxjs/operators';

export const loginGuard: CanActivateFn = (route, state) => {
  const loginService = inject(LoginService);
  const router = inject(Router);

  // Get token from localStorage to check if we should wait for user load
  const hasToken = !!loginService.getToken();

  return loginService.user.pipe(
    // Skip the initial null value only if we have a token (meaning user should load)
    skipWhile((user, index) => hasToken && index === 0 && user === null),
    take(1),
    map(user => {
      if (!!user) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};
