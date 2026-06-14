import { Component, OnInit, OnChanges, SimpleChanges, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ThemeService, AppTheme } from '../../shared/theme.service';

import { MatButtonToggleModule } from '@angular/material/button-toggle';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    TranslocoModule,
    MatSelectModule,
    MatButtonToggleModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit, OnChanges {
  @Input() isActive = false;

  isLoading = false;
  isSaving = false;
  errors: string[] = [];
  successMessage = '';

  // Profile fields
  name = '';
  username = '';
  email = '';

  // Password fields
  currentPassword = '';
  newPassword = '';
  passwordConfirmation = '';

  // Language
  currentLang = 'en';
  availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'hr', label: 'Hrvatski' }
  ];

  // Theme
  currentTheme: AppTheme = 'dojo-dark';

  // Track original values for dirty detection
  private originalValues = { name: '', username: '', email: '' };

  constructor(
    private cdr: ChangeDetectorRef,
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private snackBar: MatSnackBar,
    private translocoService: TranslocoService,
    private themeService: ThemeService
  ) {
    this.currentLang = this.translocoService.getActiveLang();
    this.currentTheme = this.themeService.currentTheme();
  }

  ngOnInit() {
    if (this.isActive) {
      this.loadSettingsData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isActive'] && changes['isActive'].currentValue && !changes['isActive'].previousValue) {
      this.loadSettingsData();
    }
  }

  get isProfileDirty(): boolean {
    return this.name !== this.originalValues.name ||
           this.username !== this.originalValues.username ||
           this.email !== this.originalValues.email;
  }

  get isPasswordFilled(): boolean {
    return this.currentPassword.length > 0 && this.newPassword.length > 0 && this.passwordConfirmation.length > 0;
  }

  get canSave(): boolean {
    return (this.isProfileDirty || this.isPasswordFilled) && !this.isSaving;
  }

  onLanguageChange(lang: string) {
    this.currentLang = lang;
    this.translocoService.setActiveLang(lang);
    localStorage.setItem('preferredLang', lang);
  }

  onThemeChange(theme: AppTheme) {
    this.currentTheme = theme;
    this.themeService.setTheme(theme);
  }

  private loadSettingsData() {
    this.isLoading = true;
    const token = this.loginService.getToken();

    this.internalApi.user.currentUser(token).subscribe({
      next: (response: any) => {
        this.name = response.name || '';
        this.username = response.username || '';
        this.email = response.email || '';
        this.originalValues = { name: this.name, username: this.username, email: this.email };
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading user data:', error);
        this.errors = ['Failed to load user data'];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSave() {
    this.errors = [];
    this.successMessage = '';

    // Validate password fields if any are filled
    if (this.newPassword || this.passwordConfirmation || this.currentPassword) {
      if (!this.currentPassword) {
        this.errors = ['Current password is required to change password'];
        this.cdr.detectChanges();
        return;
      }
      if (this.newPassword !== this.passwordConfirmation) {
        this.errors = ['New password and confirmation do not match'];
        this.cdr.detectChanges();
        return;
      }
      if (this.newPassword.length < 6) {
        this.errors = ['New password must be at least 6 characters'];
        this.cdr.detectChanges();
        return;
      }
    }

    this.isSaving = true;
    const token = this.loginService.getToken();

    const userData: any = {};

    // Only send changed profile fields
    if (this.name !== this.originalValues.name) userData.name = this.name;
    if (this.username !== this.originalValues.username) userData.username = this.username;
    if (this.email !== this.originalValues.email) userData.email = this.email;

    // Include password fields if set
    if (this.newPassword) {
      userData.password = this.newPassword;
      userData.password_confirmation = this.passwordConfirmation;
      userData.current_password = this.currentPassword;
    }

    this.internalApi.user.updateCurrentUser(token, userData).subscribe({
      next: (response: any) => {
        this.name = response.name || '';
        this.username = response.username || '';
        this.email = response.email || '';
        this.originalValues = { name: this.name, username: this.username, email: this.email };

        // Clear password fields
        this.currentPassword = '';
        this.newPassword = '';
        this.passwordConfirmation = '';

        this.isSaving = false;
        this.snackBar.open('Settings saved successfully!', 'OK', { duration: 3000 });

        // Refresh user data in LoginService
        this.loginService.setCurrentUser();
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isSaving = false;
        if (error.error?.errors) {
          this.errors = error.error.errors;
        } else {
          this.errors = ['Failed to save settings. Please try again.'];
        }
        this.cdr.detectChanges();
      }
    });
  }


}
