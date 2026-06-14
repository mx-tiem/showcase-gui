import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoginService } from '../../../../login/login.service';
import { InternalApiService } from '../../../../shared/internal-api.service';

interface ReservationData {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    available_playhours: number;
  };
  machine: {
    id: number;
    name: string;
    machine_type: string;
    status: string;
    hardware_configuration: string;
    start_work_hours: string;
    end_work_hours: string;
    working_days: string[];
  };
  creator: {
    id: number;
    email: string;
    name: string;
    role: string;
    available_playhours: number;
  };
}

@Component({
  selector: 'app-show-dialog',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatDialogModule, MatIconModule, MatExpansionModule, MatSliderModule, MatSelectModule, MatFormFieldModule, MatTooltipModule, CommonModule, FormsModule],
  templateUrl: './show-dialog.html',
  styleUrl: './show-dialog.scss',
})
export class ShowDialog implements OnInit {
  allStatuses = ['confirmed', 'active', 'done', 'cancelled'];

  // Extend fields
  extendHours = 1;
  maxExtendHours = 0;
  maxExtendHoursFree = 0;
  availablePlayhours = 0;
  currentEndTime = '';
  currentEndDate: Date | null = null;
  extendLoading = false;
  extendError = '';
  extendSuccess = '';

  // Machine switch fields
  machines: any[] = [];
  selectedMachineId: number = 0;
  switchingMachine = false;
  switchSuccess = '';
  switchError = '';

  get availableStatuses(): string[] {
    const currentStatus = this.data.status?.toLowerCase();
    return this.allStatuses.filter(s => s !== currentStatus);
  }

  get isActive(): boolean {
    return this.data.status?.toLowerCase() === 'active';
  }

  constructor(
    public dialogRef: MatDialogRef<ShowDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ReservationData,
    private loginService: LoginService,
    private internalApi: InternalApiService
  ) {}

  ngOnInit(): void {
    this.selectedMachineId = this.data.machine.id;
    this.loadMachines();
    if (this.isActive) {
      this.loadMaxExtend();
    }
  }

  loadMachines(): void {
    const token = this.loginService.getToken();
    if (!token) return;

    this.internalApi.admin.machines.getMachines(token, { per_page: 100 }).subscribe({
      next: (response: any) => {
        this.machines = response.machines || [];
      },
      error: (error: any) => {
        console.error('Error loading machines:', error);
      }
    });
  }

  onSwitchMachine(): void {
    const token = this.loginService.getToken();
    if (!token || this.selectedMachineId === this.data.machine.id) return;

    this.switchingMachine = true;
    this.switchSuccess = '';
    this.switchError = '';

    this.internalApi.admin.reservations.updateReservation(token, this.data.id, { machine_id: this.selectedMachineId }).subscribe({
      next: (response: any) => {
        const newMachine = this.machines.find(m => m.id === this.selectedMachineId);
        if (newMachine) {
          this.data.machine = newMachine;
        }
        this.switchSuccess = `Switched to ${this.data.machine.name}`;
        this.switchingMachine = false;
        setTimeout(() => this.switchSuccess = '', 3000);
      },
      error: (error: any) => {
        this.switchError = error.error?.errors?.join(', ') || error.error?.error || 'Failed to switch machine';
        this.switchingMachine = false;
        this.selectedMachineId = this.data.machine.id;
        setTimeout(() => this.switchError = '', 4000);
      }
    });
  }

  loadMaxExtend(): void {
    const token = this.loginService.getToken();
    if (!token) return;

    this.extendLoading = true;
    this.internalApi.admin.reservations.getMaxExtend(token, this.data.id).subscribe({
      next: (response: any) => {
        this.maxExtendHours = response.max_extend_hours;
        this.maxExtendHoursFree = response.max_extend_hours_free;
        this.availablePlayhours = response.available_playhours;
        this.currentEndDate = new Date(response.current_end_time);
        const h = this.currentEndDate.getHours().toString().padStart(2, '0');
        const m = this.currentEndDate.getMinutes().toString().padStart(2, '0');
        this.currentEndTime = `${h}:${m}`;
        this.extendHours = Math.min(1, this.maxExtendHours);
        this.extendLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading max extend:', error);
        this.extendLoading = false;
      }
    });
  }

  onExtendHoursInput(value: string): void {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0.5 && num <= this.maxExtendHours) {
      this.extendHours = Math.round(num * 2) / 2; // round to nearest 0.5
    }
  }

  getNewEndTime(): string {
    if (!this.currentEndDate) return '';
    const newEnd = new Date(this.currentEndDate.getTime() + this.extendHours * 3600 * 1000);
    const h = newEnd.getHours().toString().padStart(2, '0');
    const m = newEnd.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  onExtendConfirm(free: boolean = false): void {
    const token = this.loginService.getToken();
    if (!token) return;

    this.extendError = '';
    this.extendSuccess = '';
    this.extendLoading = true;

    this.internalApi.admin.reservations.extendReservation(token, this.data.id, this.extendHours, free).subscribe({
      next: (response: any) => {
        this.extendSuccess = `Extended by ${this.extendHours}h. New end: ${this.getNewEndTime()}`;
        this.extendLoading = false;
        // Update dialog data with new end time
        if (response.reservation) {
          this.data.end_time = response.reservation.end_time;
        }
        this.loadMaxExtend(); // Refresh max extend info
      },
      error: (error: any) => {
        this.extendError = error.error?.error || 'Failed to extend reservation';
        this.extendLoading = false;
      }
    });
  }

  onStatusChange(status: string): void {
    if (status === 'cancelled') {
      this.dialogRef.close({ action: 'cancel', reservation: this.data });
    } else {
      this.dialogRef.close({ action: 'update_status', status, reservation: this.data });
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'confirmed': return 'check_circle';
      case 'active': return 'play_circle';
      case 'done': return 'task_alt';
      case 'cancelled': return 'cancel';
      default: return 'help';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'confirmed': return 'primary';
      case 'active': return 'accent';
      case 'done': return 'primary';
      case 'cancelled': return 'warn';
      default: return '';
    }
  }

  formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Zagreb'
    });
  }
}
