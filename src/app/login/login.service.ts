import { Injectable, OnDestroy } from '@angular/core';
import { User, UserInterface } from './user.model';
import { BehaviorSubject, catchError, Subscription, tap, throwError } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Router } from '@angular/router';
import { InternalApiService } from '../shared/internal-api.service';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LoginService implements OnDestroy {

  user = new BehaviorSubject<User|null>(null);
  isLoading = false;
  isError = false;
  jwtHelper = new JwtHelperService();

  logoutSub = new Subscription();

  tokenExpirationDateTime = 0;
  tokenExpirationTimer: any;
  userTokenValue: string | undefined;

  constructor(private router: Router, private internalApi: InternalApiService){}

  ngOnDestroy(): void {
    this.logoutSub.unsubscribe();
  }

  login (username: string, password: string) {
    return this.internalApi.auth.login(username, password)
      .pipe(
        catchError(this.handleError),
        tap((resData: UserInterface) => {
          this.handleAuthentication(resData)
        })
      )
  }


  autoLogin() {
    const userData: UserInterface = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData.token) {
      return;
    }

    this.tokenExpirationDateTime = new Date(this.jwtHelper.decodeToken(userData.token).exp * 1000).getTime();
    this.tokenExpirationTimer = this.tokenExpirationDateTime - new Date().getTime()

    if (new Date(this.tokenExpirationDateTime) > new Date()) {
      const loadedUser = new User(
        userData.email,
        userData.id,
        userData.token,
        userData.name,
        userData.role
      );
      this.user.next(loadedUser);
      this.autoLogout(this.tokenExpirationTimer);
      this.router.navigate(['/']);
    } else {
      this.logout()
    }
  }

  logout() {
    const token = this.getToken();

    this.user.next(null);
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    this.tokenExpirationTimer = null;
    localStorage.removeItem('userData');

    if (token) {
      this.internalApi.auth.logout(token).subscribe({
        error: (err: any) => console.error('Logout request failed:', err)
      });
    }

    this.router.navigate(['/login']);
  }

  autoLogout(expirationDuration: number) {
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  getToken() {
    try {
      const userData: UserInterface = JSON.parse(localStorage.getItem('userData') || '{}');
      return userData.token || '';
    } catch (error) {
      return '';
    }
  }

  setCurrentUser() {
    const token = this.getToken();
    if (!token) {
      this.user.next(null);
      return;
    }

    this.internalApi.user.currentUser(token)
      .pipe(
        catchError(error => {
          this.user.next(null);
          localStorage.removeItem('userData');
          return throwError(error);
        })
      )
      .subscribe(response => {
        if (response) {
          const user = new User(
            response.email,
            response.id,
            token,
            response.name,
            response.role,
          );
          this.user.next(user);
        } else {
          this.user.next(null);
        }
      });
  }

  private handleAuthentication(userData: any) {
    const user = new User(
      userData.body.status.data.user.email,
      userData.body.status.data.user.id,
      userData.headers.get('Authorization'),
      userData.body.status.data.user.name,
      userData.body.status.data.user.role
    );
    this.user.next(user);
    localStorage.setItem('userData', JSON.stringify(user));
    console.log("loginService: ", this.user.value)
    this.tokenExpirationDateTime = new Date(this.jwtHelper.decodeToken(user.token).exp * 1000).getTime();
    this.tokenExpirationTimer = this.tokenExpirationDateTime - new Date().getTime()
    this.autoLogout(this.tokenExpirationTimer);
  }

  private handleError(errorRes: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';

    if (!!errorRes.error.message) {
      return throwError(errorRes.error.message);
    }

    return throwError(errorMessage);
  }
}
