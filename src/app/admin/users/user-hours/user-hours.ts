import { Component, Input, OnInit, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionPanel } from '@angular/material/expansion';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslocoModule } from '@jsverse/transloco';

interface MachineHour {
  id: number;
  user_id: number;
  hours_amount: number;
  hours_type: string;
  hours_status: string;
  expires: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  machine_hours: MachineHour[];
  total_count: number;
  page: number;
  per_page: number;
}

@Component({
  selector: 'app-user-hours',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    FormsModule,
    MatSnackBarModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    TranslocoModule
  ],
  templateUrl: './user-hours.html',
  styleUrl: './user-hours.scss',
})
export class UserHours implements OnInit, AfterViewInit {
  @Input() userId!: number;
  @Input() userData: any;
  @ViewChild('addHoursPanel') addHoursPanel!: MatExpansionPanel;
  
  // Playhours data
  playhoursData: MachineHour[] = [];
  playhoursLoading = false;
  playhoursError: string | null = null;
  playhoursTotalCount = 0;
  playhoursPage = 0;
  playhoursPerPage = 5;
  playhoursActive = 0;
  playhoursUsed = 0;
  
  displayedColumns: string[] = ['hours_amount', 'hours_status', 'expires', 'created_at', 'actions'];

  // Admin discount editing
  editingAdminDiscount = false;
  savingAdminDiscount = false;
  adminDiscountValue = 0;
  
  // Form for adding hours
  addHoursForm: FormGroup;
  submitting = false;
  
  hoursTypes = [
    { value: 'playhours', label: 'Play Hours' }
  ];
  
  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.addHoursForm = this.fb.group({
      hoursAmount: ['', [Validators.required, Validators.min(0.1)]],
      hoursType: ['playhours', Validators.required],
      expires: [false],
      expiresAt: ['']
    });
    
    // Watch for expires change to update validators
    this.addHoursForm.get('expires')?.valueChanges.subscribe(expires => {
      const expiresAtControl = this.addHoursForm.get('expiresAt');
      if (expires) {
        expiresAtControl?.setValidators([Validators.required]);
      } else {
        expiresAtControl?.clearValidators();
      }
      expiresAtControl?.updateValueAndValidity();
    });
  }
  
  ngOnInit(): void {
    // Initialization happens in ngAfterViewInit to avoid ExpressionChangedAfterItHasBeenCheckedError
  }
  
  ngAfterViewInit(): void {
    this.loadPlayhours();
    this.loadPlayhoursSummary();
  }
  
  loadPlayhours(): void {
    this.playhoursLoading = true;
    this.playhoursError = null;
    const token = this.loginService.getToken();
    const params = {
      page: this.playhoursPage + 1,
      per_page: this.playhoursPerPage,
      sort_by: 'updated_at',
      sort_direction: 'desc'
    };
    
    this.internalApi.admin.machineHours.getPlayhoursForUser(token, this.userId, params).subscribe({
      next: (response: any) => {
        this.playhoursData = response.machine_hours || [];
        this.playhoursTotalCount = response.pagy?.total_count || 0;
        this.playhoursLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading playhours:', error);
        this.playhoursError = 'Failed to load playhours data';
        this.playhoursLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  loadPlayhoursSummary(): void {
    const token = this.loginService.getToken();
    const params = { hours_type: 'playhours' };
    
    this.internalApi.admin.machineHours.getTotalHoursForUser(token, this.userId, params).subscribe({
      next: (response: any) => {
        this.playhoursActive = response.active || 0;
        this.playhoursUsed = response.used || 0;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading playhours summary:', error);
      }
    });
  }
  
  onPlayhoursPageChange(event: PageEvent): void {
    this.playhoursPage = event.pageIndex;
    this.playhoursPerPage = event.pageSize;
    this.loadPlayhours();
  }
  

  
  onSubmitAddHours(): void {
    if (this.addHoursForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000 });
      return;
    }
    
    this.submitting = true;
    const formValue = this.addHoursForm.value;
    const token = this.loginService.getToken();
    
    const machineHourData: any = {
      user_id: this.userId,
      hours_amount: formValue.hoursAmount,
      hours_type: formValue.hoursType,
      expires: formValue.expires
    };
    
    if (formValue.expires && formValue.expiresAt) {
      // Format date as YYYY-MM-DD
      const expiresAt = new Date(formValue.expiresAt);
      const year = expiresAt.getFullYear();
      const month = String(expiresAt.getMonth() + 1).padStart(2, '0');
      const day = String(expiresAt.getDate()).padStart(2, '0');
      machineHourData.expires_at = `${year}-${month}-${day}`;
    }
    
    this.internalApi.admin.machineHours.createMachineHours(token, machineHourData).subscribe({
      next: (response: any) => {
        this.snackBar.open('Hours added successfully', 'Close', { duration: 3000 });
        this.submitting = false;
        this.resetForm();
        this.addHoursPanel.close();
        // Reload all data
        this.loadPlayhours();
        this.loadPlayhoursSummary();
      },
      error: (error) => {
        console.error('Error adding hours:', error);
        this.snackBar.open('Failed to add hours', 'Close', { duration: 3000 });
        this.submitting = false;
      }
    });
  }
  
  resetForm(): void {
    this.addHoursForm.reset({
      hoursType: 'playhours',
      expires: false
    });
  }
  
  startEditAdminDiscount(): void {
    this.adminDiscountValue = this.userData?.discount_admin || 0;
    this.editingAdminDiscount = true;
  }

  cancelEditAdminDiscount(): void {
    this.editingAdminDiscount = false;
  }

  saveAdminDiscount(): void {
    this.savingAdminDiscount = true;
    const token = this.loginService.getToken();

    this.internalApi.admin.users.updateUser(token, this.userId, { discount_admin: this.adminDiscountValue }).subscribe({
      next: () => {
        this.userData.discount_admin = this.adminDiscountValue;
        this.editingAdminDiscount = false;
        this.savingAdminDiscount = false;
        this.snackBar.open('Admin discount updated', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error updating admin discount:', error);
        this.snackBar.open('Failed to update admin discount', 'Close', { duration: 3000 });
        this.savingAdminDiscount = false;
      }
    });
  }

  deleteMachineHour(hourId: number, hoursType: string): void {
    if (!confirm('Are you sure you want to delete this machine hour record?')) {
      return;
    }
    
    const token = this.loginService.getToken();
    
    this.internalApi.admin.machineHours.deleteMachineHour(token, hourId).subscribe({
      next: () => {
        this.snackBar.open('Machine hour deleted successfully', 'Close', { duration: 3000 });
        // Reload the appropriate table and summary
        if (hoursType === 'playhours') {
          this.loadPlayhours();
          this.loadPlayhoursSummary();
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting machine hour:', error);
        this.snackBar.open('Failed to delete machine hour', 'Close', { duration: 3000 });
      }
    });
  }
}
