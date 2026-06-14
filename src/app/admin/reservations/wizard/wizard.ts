import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { NgxMatTimepickerModule } from 'ngx-mat-timepicker';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';

export interface WizardData {
  mode: 'create' | 'edit';
  reservationId?: number;
  initialData?: any;
}

@Component({
  selector: 'app-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatIconModule,
    MatExpansionModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    NgxMatTimepickerModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './wizard.html',
  styleUrl: './wizard.scss',
})
export class Wizard implements OnInit {
  // Form groups for each step
  basicInfoForm: FormGroup;
  detailsForm: FormGroup;
  confirmationForm: FormGroup;

  users: any[] = [];
  userSearchTerm = '';
  selectedUsers: any[] = [];
  availabilityData: any[] = [];
  selectedReservation: any = null;
  checkingAvailability = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<Wizard>,
    @Inject(MAT_DIALOG_DATA) public data: WizardData,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {
    // Initialize form groups for each step
    this.basicInfoForm = this.fb.group({
      users: [[], Validators.required],
      startDate: ['', Validators.required],
      startTime: ['', Validators.required],
      hours: ['', [Validators.required, Validators.min(0.5)]]
    });

    // Add custom validator after form is created
    this.basicInfoForm.get('hours')?.addValidators(this.maxHoursValidator());

    this.detailsForm = this.fb.group({
      selectedReservation: ['', Validators.required]
    });

    this.confirmationForm = this.fb.group({
      // Will add fields in next iteration
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  maxHoursValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || this.selectedUsers.length === 0) {
        return null;
      }
      
      const minUserHours = this.getMinimumUserHours();
      if (minUserHours === null) {
        return null;
      }
      
      const duration = parseFloat(control.value);
      if (duration > minUserHours) {
        return { maxHours: { max: minUserHours, actual: duration } };
      }
      
      return null;
    };
  }

  getMinimumUserHours(): number | null {
    if (this.selectedUsers.length === 0) {
      return null;
    }
    
    const hours = this.selectedUsers
      .map(u => u.available_playhours || 0)
      .filter(h => h > 0);
    
    if (hours.length === 0) {
      return null;
    }
    
    return Math.min(...hours);
  }

  isInsufficientHours(user: any): boolean {
    const requestedHours = this.basicInfoForm.get('hours')?.value;
    if (!requestedHours) {
      return false;
    }
    const userHours = user.available_playhours || 0;
    return userHours < requestedHours;
  }

  hasAllUsersSufficientHours(): boolean {
    if (this.selectedUsers.length === 0) {
      return false; // Can't proceed without users
    }
    
    const requestedHours = this.basicInfoForm.get('hours')?.value;
    if (!requestedHours) {
      return false; // Can't proceed without duration
    }
    
    // Check if all selected users have sufficient hours
    return this.selectedUsers.every(user => {
      const userHours = user.available_playhours || 0;
      return userHours >= requestedHours;
    });
  }

  loadUsers(): void {
    const token = this.loginService.getToken();
    this.internalApi.admin.users.getUsers(token, { per_page: 1000 }).subscribe({
      next: (response: any) => {
        this.users = response.users || [];
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  get filteredUsers() {
    if (!this.userSearchTerm || typeof this.userSearchTerm !== 'string') return [];
    const searchTerm = this.userSearchTerm.toLowerCase();
    if (!searchTerm) return [];
    
    const selectedUserIds = this.selectedUsers.map(u => u.id);
    return this.users.filter(u => 
      !selectedUserIds.includes(u.id) &&
      (u.name.toLowerCase().includes(searchTerm) || 
       u.email.toLowerCase().includes(searchTerm))
    ).slice(0, 10);
  }

  onUserSearch(): void {
    // Trigger filtering
  }

  selectUser(user: any): void {
    if (user && !this.selectedUsers.find(u => u.id === user.id)) {
      const token = this.loginService.getToken();
      
      // Add user immediately to selectedUsers for chip display
      this.selectedUsers.push(user);
      this.updateUsersFormControl();
      this.userSearchTerm = '';
      
      // Fetch full user details in the background
      this.internalApi.admin.users.showUser(token, user.id).subscribe({
        next: (response: any) => {
          // Update the user in the array with full details
          const index = this.selectedUsers.findIndex(u => u.id === user.id);
          if (index >= 0 && response.user) {
            this.selectedUsers[index] = response.user;
            // Revalidate hours field after user details are loaded
            this.basicInfoForm.get('hours')?.updateValueAndValidity();
          }
        },
        error: (error) => {
          console.error('Error loading user info:', error);
          // User already added with basic info, no need to do anything
        }
      });
    }
  }

  removeUser(user: any): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index >= 0) {
      this.selectedUsers.splice(index, 1);
      this.updateUsersFormControl();
      // Revalidate hours field after user is removed
      this.basicInfoForm.get('hours')?.updateValueAndValidity();
    }
  }

  updateUsersFormControl(): void {
    const userIds = this.selectedUsers.map(u => u.id);
    this.basicInfoForm.patchValue({ users: userIds });
  }

  checkAvailability(stepper: any): void {
    if (!this.basicInfoForm.valid) {
      return;
    }

    this.checkingAvailability = true;
    const formValue = this.basicInfoForm.value;
    const token = this.loginService.getToken();

    // Format date as YYYY-MM-DD using local date components
    const startDate = formValue.startDate;
    let formattedDate: string;
    if (startDate instanceof Date) {
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    } else {
      formattedDate = startDate;
    }

    // Format time as HH:MM
    const startTime = formValue.startTime;

    this.internalApi.admin.reservations.checkAvailability(
      token,
      formValue.users,
      formattedDate,
      startTime,
      formValue.hours
    ).subscribe({
      next: (response: any) => {
        this.availabilityData = response || [];
        this.checkingAvailability = false;
        stepper.next();
      },
      error: (error) => {
        console.error('Error checking availability:', error);
        this.checkingAvailability = false;
        alert('Failed to check availability. Please try again.');
      }
    });
  }

  selectReservationSlot(dayData: any, reservation: any, stepper: any): void {
    this.selectedReservation = {
      date: dayData.date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      machines: reservation.machines,
      users: dayData.users,
      duration: dayData.duration
    };
    this.detailsForm.patchValue({ selectedReservation: this.selectedReservation });
    
    // Build usersMachines object pairing users with machines
    const usersMachines: { [key: number]: number } = {};
    const maxLength = Math.max(dayData.users.length, reservation.machines.length);
    
    for (let i = 0; i < maxLength; i++) {
      const userId = dayData.users[i]?.id;
      const machineId = reservation.machines[i]?.machine_id;
      if (userId && machineId) {
        usersMachines[userId] = machineId;
      }
    }
    
    // Create reservation with all user/machine pairs
    const token = this.loginService.getToken();
    const reservationData = {
      start_datetime: this.formatDateTimeForAPI(reservation.start_time),
      end_datetime: this.formatDateTimeForAPI(reservation.end_time),
      usersMachines: usersMachines
    };
    
    this.internalApi.admin.reservations.createReservation(token, reservationData).subscribe({
      next: () => {
        this.dialogRef.close({ action: 'created', data: reservationData });
      },
      error: (error) => {
        console.error('Error creating reservation:', error);
        alert('Failed to create reservation. Please try again.');
      }
    });
  }

  formatDateTimeForAPI(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  formatTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatHourRange(minHour: string, maxHour: string): string {
    const minTime = this.formatTime(minHour);
    const maxTime = this.formatTime(maxHour);
    return `${minTime} - ${maxTime}`;
  }

  getUserNames(users: any[]): string {
    return users.map(u => u.name).join(', ');
  }

  getMachineNames(machines: any[]): string {
    return machines.map(m => m.machine_name).join(', ');
  }

  getUserMachinePairs(users: any[], machines: any[]): Array<{user: string, machine: string}> {
    const pairs = [];
    const maxLength = Math.max(users.length, machines.length);
    for (let i = 0; i < maxLength; i++) {
      pairs.push({
        user: users[i]?.name || '',
        machine: machines[i]?.machine_name || ''
      });
    }
    return pairs;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    // Will implement in next iteration
    console.log('Submit reservation');
    this.dialogRef.close({ action: 'save', data: {} });
  }
}
