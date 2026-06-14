import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginService } from './login.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { UserInterface } from './user.model';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslocoModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  loginForm = new FormGroup({
    login: new FormControl('', [Validators.required, Validators.minLength(3)]),
    password: new FormControl('', [Validators.required, Validators.minLength(3)]),
  });

  isLoading = false;
  hasError = false;

  error = '';

  constructor(private loginService: LoginService, private router: Router) {}

  ngOnInit(): void {
    this.loginService.autoLogin();
  }

  onSubmit() {
    this.isLoading = true;

    let loginObs: Observable<UserInterface>;

    loginObs = this.loginService.login(this.loginForm.value.login!, this.loginForm.value.password!)

    setTimeout(()=>{
      loginObs.subscribe(
        userResponse => {
          console.log("setTimeout: ", this.loginService.user.value)
          this.isLoading = false;
          this.hasError = false;
          this.router.navigate(['/home']);
        }, errorMessage => {
          this.error = errorMessage;
          this.hasError = true;
          this.isLoading = false;
        })
    }, 400)
  }
}
