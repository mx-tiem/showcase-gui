import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
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
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';
import { PillButton } from '../../../shared/buttons/pill-button/pill-button';

@Component({
  selector: 'app-reservation-wizard',
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
    TimepickerModule,
    ReactiveFormsModule,
    FormsModule,
    TranslocoModule,
    PillButton
  ],
  templateUrl: './reservation-wizard.html',
  styleUrl: './reservation-wizard.scss',
  animations: [
    trigger('tabSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(30px)' }),
        animate('500ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(-30px)' }))
      ])
    ])
  ]
})
export class ReservationWizard implements OnInit, OnChanges {
  @Input() isActive = false;
  @Output() reservationCreated = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();
  @ViewChild('stepper') stepper!: MatStepper;

  // Form groups for each step
  sessionTypeForm: FormGroup;
  basicInfoForm: FormGroup;
  detailsForm: FormGroup;
  confirmationForm: FormGroup;

  users: any[] = [];
  selectedUsers: any[] = [];
  availabilityData: any[] = [];
  selectedReservation: any = null;
  checkingAvailability = false;
  currentUser: any = null;
  friendsFilter: string = '';
  sessionType: string = '';
  showFriendsPanel = false;
  maxUsers: number = Infinity;
  selectedDateIndex = 0;
  highlightedSlotTime: string | null = null;
  private initialized = false;

  constructor(
    private fb: FormBuilder,
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize form groups for each step
    this.sessionTypeForm = this.fb.group({
      sessionType: ['', Validators.required]
    });

    this.basicInfoForm = this.fb.group({
      startDate: [new Date(), Validators.required],
      startTime: [this.getNextFullHour(), Validators.required],
      endTime: [this.getNextFullHour(1), Validators.required]
    });

    this.detailsForm = this.fb.group({
      selectedReservation: ['', Validators.required]
    });

    this.confirmationForm = this.fb.group({
      // Will add fields in next iteration
    });
  }

  ngOnInit(): void {
    if (this.isActive) {
      this.initializeWizard();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isActive'] && changes['isActive'].currentValue && !changes['isActive'].previousValue) {
      this.initializeWizard();
    }
  }

  private initializeWizard() {
    if (this.initialized) return;
    // Reset form when wizard becomes active
    this.resetWizard();
    this.initialized = true;
    this.loadCurrentUserAndFriends();
  }

  private resetWizard() {
    this.initialized = false;
    this.sessionTypeForm.reset();
    this.basicInfoForm.reset({
      startDate: new Date(),
      startTime: this.getNextFullHour(),
      endTime: this.getNextFullHour(1)
    });
    this.detailsForm.reset();
    this.confirmationForm.reset();
    this.selectedUsers = [];
    this.availabilityData = [];
    this.selectedReservation = null;
    this.checkingAvailability = false;
    this.sessionType = '';
    this.showFriendsPanel = false;
  }

  private getNextFullHour(offsetHours: number = 0): Date {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1 + offsetHours);
    return d;
  }

  get calculatedDuration(): number | null {
    const start = this.basicInfoForm.get('startTime')?.value;
    const end = this.basicInfoForm.get('endTime')?.value;
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    return Math.round((diffMs / (1000 * 60 * 60)) * 4) / 4; // round to nearest 0.25
  }

  get formattedDuration(): string | null {
    const dur = this.calculatedDuration;
    if (dur === null) return null;
    const hours = Math.floor(dur);
    const minutes = Math.round((dur - hours) * 60);
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}:${String(minutes).padStart(2, '0')}h`;
  }

  get formattedTotalDuration(): string | null {
    const dur = this.formattedDuration;
    if (!dur) return null;
    const userCount = this.selectedUsers.length;
    if (userCount > 1) return `${userCount}x ${dur}`;
    return dur;
  }

  get confirmationCost(): string {
    if (!this.selectedReservation) return '';
    const dur = this.selectedReservation.duration;
    const formatted = this.formatHours(dur);
    const userCount = this.selectedReservation.users?.length || 1;
    const total = dur * userCount;
    const totalFormatted = this.formatHours(total);
    if (userCount > 1) return `${userCount}x ${formatted} = ${totalFormatted}`;
    return totalFormatted;
  }

  formatHours(value: number): string {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}:${String(minutes).padStart(2, '0')}h`;
  }

  onStartTimeChange(): void {
    const start = this.basicInfoForm.get('startTime')?.value;
    const end = this.basicInfoForm.get('endTime')?.value;
    if (start instanceof Date && end instanceof Date) {
      const minEnd = new Date(start.getTime() + 30 * 60 * 1000);
      if (end.getTime() < minEnd.getTime()) {
        this.basicInfoForm.patchValue({ endTime: minEnd });
      }
    }
  }

  onEndTimeChange(): void {
    const start = this.basicInfoForm.get('startTime')?.value;
    const end = this.basicInfoForm.get('endTime')?.value;
    if (start instanceof Date && end instanceof Date) {
      const maxStart = new Date(end.getTime() - 30 * 60 * 1000);
      if (start.getTime() > maxStart.getTime()) {
        this.basicInfoForm.patchValue({ startTime: maxStart });
      }
    }
  }

  getMinimumUserHours(): number | null {
    if (this.selectedUsers.length === 0) {
      return null;
    }
    
    const hours = this.selectedUsers
      .map(u => u.total_playhours || 0)
      .filter(h => h > 0);
    
    if (hours.length === 0) {
      return null;
    }
    
    return Math.min(...hours);
  }

  loadCurrentUserAndFriends(): void {
    const token = this.loginService.getToken();
    
    // Load current user
    this.internalApi.user.currentUser(token).subscribe({
      next: (response: any) => {
        this.currentUser = response;
        // Auto-select current user
        this.selectedUsers.push(this.currentUser);
        this.cdr.detectChanges();
        this.loadAvailableMachineCount();
        this.loadFriends();
      },
      error: (error) => {
        console.error('Error loading current user:', error);
      }
    });
  }

  loadAvailableMachineCount(): void {
    const token = this.loginService.getToken();
    this.internalApi.user.machines.getMachines(token).subscribe({
      next: (response: any) => {
        const machines = Array.isArray(response) ? response : (response.machines || []);
        this.maxUsers = machines.length;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading machines:', error);
      }
    });
  }

  get isMaxUsersReached(): boolean {
    return this.selectedUsers.length >= this.maxUsers;
  }

  loadFriends(): void {
    const token = this.loginService.getToken();
    this.internalApi.user.friends.getFriends(token).subscribe({
      next: (response: any) => {
        this.users = response.friends || [];
        // Add current user to the users list for search purposes
        if (this.currentUser && !this.users.find(u => u.id === this.currentUser.id)) {
          this.users.unshift(this.currentUser);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading friends:', error);
      }
    });
  }

  get availableFriends() {
    const selectedUserIds = this.selectedUsers.map(u => u.id);
    let filteredUsers = this.users.filter(u => !selectedUserIds.includes(u.id));
    
    if (this.friendsFilter.trim()) {
      const filter = this.friendsFilter.toLowerCase().trim();
      filteredUsers = filteredUsers.filter(u => 
        u.name.toLowerCase().includes(filter) || 
        u.email.toLowerCase().includes(filter)
      );
    }
    
    return filteredUsers;
  }

  hasCurrentUserEnoughHours(): boolean {
    if (!this.currentUser || this.selectedUsers.length === 0) {
      return false;
    }
    
    const duration = this.calculatedDuration;
    if (!duration) {
      return false;
    }
    
    const totalRequiredHours = duration * this.selectedUsers.length;
    const availableHours = this.currentUser.available_playhours || 0;
    
    return availableHours >= totalRequiredHours;
  }

  shouldShowInsufficientHoursError(): boolean {
    if (!this.currentUser || this.selectedUsers.length === 0) {
      return false;
    }
    
    const duration = this.calculatedDuration;
    if (!duration) {
      return false;
    }
    
    return !this.hasCurrentUserEnoughHours();
  }

  get requiredHours(): number | null {
    const duration = this.calculatedDuration;
    if (!duration || this.selectedUsers.length === 0) return null;
    return duration * this.selectedUsers.length;
  }

  addFriend(friend: any): void {
    if (friend && !this.selectedUsers.find(u => u.id === friend.id) && !this.isMaxUsersReached) {
      this.selectedUsers.push(friend);
      // Revalidate hours field after user is added
      this.basicInfoForm.get('hours')?.updateValueAndValidity();
    }
  }

  removeUser(user: any): void {
    if (user.id === this.currentUser?.id) return;
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index >= 0) {
      this.selectedUsers.splice(index, 1);
      // Revalidate hours field after user is removed
      this.basicInfoForm.get('hours')?.updateValueAndValidity();
    }
  }

  selectSessionType(type: string, stepper: any): void {
    this.sessionType = type;
    this.sessionTypeForm.patchValue({ sessionType: type });

    if (type === 'solo') {
      this.selectedUsers = this.currentUser ? [this.currentUser] : [];
      this.showFriendsPanel = false;
      stepper.next();
    } else {
      if (this.currentUser && !this.selectedUsers.find((u: any) => u.id === this.currentUser.id)) {
        this.selectedUsers = [this.currentUser];
      }
      this.showFriendsPanel = true;
    }
  }

  proceedFromFriends(stepper: any): void {
    stepper.next();
  }

  onDateSelected(date: Date): void {
    this.basicInfoForm.patchValue({ startDate: date });
  }

  get currentStepIndex(): number {
    return this.stepper?.selectedIndex ?? 0;
  }

  get canGoBack(): boolean {
    return this.currentStepIndex > 0;
  }

  get canGoNext(): boolean {
    const step = this.currentStepIndex;
    if (step === 0) {
      // Session type step: solo auto-advances; friends need at least 2 users
      return this.showFriendsPanel && this.selectedUsers.length >= 2;
    }
    if (step === 1) {
      // Schedule step
      return this.basicInfoForm.valid && !this.checkingAvailability && this.hasCurrentUserEnoughHours();
    }
    // Step 2 (time slot) — user selects a card, no generic "Next"
    // Step 3 (confirmation) — no next, it's the last step
    return false;
  }

  goBack(): void {
    if (this.canGoBack) {
      this.stepper.previous();
    }
  }

  goNext(): void {
    const step = this.currentStepIndex;
    if (step === 0 && this.showFriendsPanel && this.selectedUsers.length >= 2) {
      this.stepper.next();
    } else if (step === 1) {
      this.checkAvailability(this.stepper);
    }
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
    const startTimeDate = formValue.startTime;
    const startTime = startTimeDate instanceof Date
      ? `${String(startTimeDate.getHours()).padStart(2, '0')}:${String(startTimeDate.getMinutes()).padStart(2, '0')}`
      : startTimeDate;

    const duration = this.calculatedDuration;
    if (!duration) return;

    const userIds = this.selectedUsers.map((u: any) => u.id);

    this.internalApi.user.reservations.checkAvailability(
      token,
      userIds,
      formattedDate,
      startTime,
      duration
    ).subscribe({
      next: (response: any) => {
        this.availabilityData = response || [];
        const originalIndex = this.availabilityData.findIndex((d: any) => d.original_date);
        this.selectedDateIndex = originalIndex >= 0 ? originalIndex : 0;
        this.highlightedSlotTime = this.findClosestSlot(formattedDate, startTime);
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

  private findClosestSlot(requestedDate: string, requestedTime: string): string | null {
    const originalDay = this.availabilityData.find((d: any) => d.original_date);
    if (!originalDay || !originalDay.available_reservations.length) return null;

    const requestedDateTime = new Date(`${requestedDate}T${requestedTime}:00`).getTime();
    let closest: any = null;
    let closestDiff = Infinity;

    for (const slot of originalDay.available_reservations) {
      const slotTime = new Date(slot.start_time).getTime();
      const diff = Math.abs(slotTime - requestedDateTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = slot;
      }
    }

    return closest?.start_time ?? null;
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
    stepper.next();
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
    this.cancelled.emit();
  }

  onSubmit(): void {
    if (!this.selectedReservation) {
      return;
    }

    const token = this.loginService.getToken();
    
    // Build usersMachines object pairing users with machines
    const usersMachines: { [key: number]: number } = {};
    const maxLength = Math.max(this.selectedReservation.users.length, this.selectedReservation.machines.length);
    
    for (let i = 0; i < maxLength; i++) {
      const userId = this.selectedReservation.users[i]?.id;
      const machineId = this.selectedReservation.machines[i]?.machine_id;
      if (userId && machineId) {
        usersMachines[userId] = machineId;
      }
    }

    const reservationData = {
      start_datetime: this.formatDateTimeForAPI(this.selectedReservation.start_time),
      end_datetime: this.formatDateTimeForAPI(this.selectedReservation.end_time),
      usersMachines: usersMachines
    };

    this.internalApi.user.reservations.createReservation(token, reservationData).subscribe({
      next: (response) => {
        this.reservationCreated.emit({ action: 'created', data: reservationData });
        this.resetWizard();
      },
      error: (error) => {
        console.error('Error creating reservation:', error);
        alert('Failed to create reservation. Please try again.');
      }
    });
  }
}