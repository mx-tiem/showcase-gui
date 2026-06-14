import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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
  selector: 'app-delete-dialog',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatDialogModule, MatSlideToggleModule, MatIconModule, MatExpansionModule, FormsModule, CommonModule],
  templateUrl: './delete-dialog.html',
  styleUrl: './delete-dialog.scss',
})
export class DeleteDialog implements OnInit {
  refundEnabled = true;
  durationHours = 0;
  hoursUntilStart = 0;
  userWouldGetRefund = false;
  freeCancellationHours = 4;

  constructor(
    public dialogRef: MatDialogRef<DeleteDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { reservation: ReservationData, freeCancellationHours: number }
  ) {}

  ngOnInit(): void {
    const reservation = this.data.reservation;
    this.freeCancellationHours = this.data.freeCancellationHours ?? 4;

    const startTime = new Date(reservation.start_time);
    const endTime = new Date(reservation.end_time);
    this.durationHours = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) * 100) / 100;
    this.hoursUntilStart = Math.round((startTime.getTime() - Date.now()) / (1000 * 60 * 60) * 10) / 10;

    // Determine what would happen if the user cancelled
    const isActive = reservation.status?.toLowerCase() === 'active';
    this.userWouldGetRefund = !isActive && this.hoursUntilStart >= this.freeCancellationHours;

    // Default toggle to match what the user would get
    this.refundEnabled = this.userWouldGetRefund;
  }

  get reservation(): ReservationData {
    return this.data.reservation;
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirmCancel(): void {
    this.dialogRef.close({
      action: 'cancel',
      refund: this.refundEnabled
    });
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
