import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgxMatTimepickerModule } from 'ngx-mat-timepicker';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

interface AppSettingsData {
  id: number;
  opening_hours: string;
  closing_hours: string;
  working_days: string[];
  free_cancellation_hours: number;
  min_hours_before_reservation: number;
  dojo_warden_secret: string | null;
  max_play_discount: number;
  max_play_discount_hours_required: number;
  start_late_tolerance: number;
}

const ALL_DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

@Component({
  selector: 'app-app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    NgxMatTimepickerModule,
    RouterModule,
    TranslocoModule,
  ],
  templateUrl: './app-settings.html',
  styleUrl: './app-settings.scss',
})
export class AppSettings implements OnInit {
  loading = false;
  saving = false;

  openingHours = '14:00';
  closingHours = '22:00';
  workingDays: Record<string, boolean> = {};
  freeCancellationHours = 4;
  minHoursBeforeReservation = 2;
  dojoWardenSecret = '';
  showDojoWardenSecret = false;
  maxPlayDiscount = 10;
  maxPlayDiscountHoursRequired = 100;
  startLateTolerance = 15;

  allDays = ALL_DAYS;
  statusMessage = '';
  statusType: 'success' | 'error' = 'success';

  constructor(
    private cdr: ChangeDetectorRef,
    private internalApi: InternalApiService,
    private loginService: LoginService,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    const token = this.loginService.getToken();

    this.internalApi.admin.appSettings.getSettings(token).subscribe({
      next: (response: any) => {
        this.applySettings(response);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading app settings:', error);
        this.showStatus('Failed to load settings.', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onSave(): void {
    this.saving = true;
    const token = this.loginService.getToken();

    const payload = {
      opening_hours: this.openingHours,
      closing_hours: this.closingHours,
      working_days: this.getSelectedDays(),
      free_cancellation_hours: this.freeCancellationHours,
      min_hours_before_reservation: this.minHoursBeforeReservation,
      dojo_warden_secret: this.dojoWardenSecret,
      max_play_discount: this.maxPlayDiscount,
      max_play_discount_hours_required: this.maxPlayDiscountHoursRequired,
      start_late_tolerance: this.startLateTolerance,
    };

    this.internalApi.admin.appSettings.updateSettings(token, payload).subscribe({
      next: (response: any) => {
        this.applySettings(response);
        this.showStatus('Settings saved successfully.', 'success');
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error saving app settings:', error);
        const message = error?.error?.errors?.join(', ') || 'Failed to save settings.';
        this.showStatus(message, 'error');
        this.saving = false;
        this.cdr.detectChanges();
      },
    });
  }

  onReset(): void {
    if (!confirm('Are you sure you want to reset all settings to their default values?')) {
      return;
    }

    this.saving = true;
    const token = this.loginService.getToken();

    this.internalApi.admin.appSettings.resetSettings(token).subscribe({
      next: (response: any) => {
        this.applySettings(response);
        this.showStatus('Settings reset to defaults.', 'success');
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error resetting app settings:', error);
        this.showStatus('Failed to reset settings.', 'error');
        this.saving = false;
        this.cdr.detectChanges();
      },
    });
  }

  private applySettings(data: any): void {
    this.openingHours = data.opening_hours || '14:00';
    this.closingHours = data.closing_hours || '22:00';
    this.freeCancellationHours = data.free_cancellation_hours ?? 4;
    this.minHoursBeforeReservation = data.min_hours_before_reservation ?? 2;
    this.dojoWardenSecret = data.dojo_warden_secret || '';
    this.maxPlayDiscount = data.max_play_discount ?? 10;
    this.maxPlayDiscountHoursRequired = data.max_play_discount_hours_required ?? 100;
    this.startLateTolerance = data.start_late_tolerance ?? 15;

    const days: string[] = data.working_days || [];
    this.workingDays = {};
    for (const day of ALL_DAYS) {
      this.workingDays[day.value] = days.includes(day.value);
    }
  }

  private getSelectedDays(): string[] {
    return ALL_DAYS
      .filter((day) => this.workingDays[day.value])
      .map((day) => day.value);
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusMessage = message;
    this.statusType = type;
    setTimeout(() => {
      this.statusMessage = '';
      this.cdr.detectChanges();
    }, 4000);
  }
}
