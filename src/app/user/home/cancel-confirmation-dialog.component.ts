import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cancel-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Cancel Reservation</h2>
    <mat-dialog-content style="font-size: 20px; line-height: 1.4;">
      <p>Are you sure you want to cancel your reservation for
        <strong>{{ data.reservation.machine }}</strong> on
        <strong>{{ data.reservation.date }}</strong>
        ({{ data.reservation.duration }})?
      </p>
      <p *ngIf="data.reservation.status === 'Active'">Active reservations are <strong>not eligible for a refund</strong>.</p>
      <p *ngIf="data.reservation.status !== 'Active'">If you cancel more than <strong>{{ data.freeCancellationHours }}</strong> hours before the start time,
        your playhours will be refunded. Otherwise, no refund will be issued.</p>

      <div class="refund-card mb-4" [class.refund]="eligibleForRefund" [class.no-refund]="!eligibleForRefund">
        <mat-icon>{{ eligibleForRefund ? 'check_circle' : 'block' }}</mat-icon>
        <span *ngIf="eligibleForRefund"><strong>{{ refundHours }}</strong> hour{{ refundHours !== 1 ? 's' : '' }} will be refunded</span>
        <span *ngIf="!eligibleForRefund"><strong>NO</strong> hours will be refunded</span>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="center">
      <button mat-raised-button color="warn" style="font-size: 20px;" [mat-dialog-close]="true">Confirm Cancellation</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .refund-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 22px;
      font-weight: 500;
      margin-top: 16px;
    }
    .refund-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .refund-card.refund {
      background-color: #1b5e20;
      color: #a5d6a7;
      border: 1px solid #388e3c;
    }
    .refund-card.no-refund {
      background-color: #b71c1c;
      color: #ef9a9a;
      border: 1px solid #d32f2f;
    }
  `]
})
export class CancelConfirmationDialogComponent implements OnInit {
  eligibleForRefund = false;
  refundHours = 0;

  constructor(
    public dialogRef: MatDialogRef<CancelConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    const reservation = this.data.reservation;
    if (reservation.status === 'Active') {
      this.eligibleForRefund = false;
    } else {
      const hoursUntilStart = (reservation.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
      this.eligibleForRefund = hoursUntilStart >= this.data.freeCancellationHours;
    }
    this.refundHours = this.eligibleForRefund ? reservation.durationHours : 0;
  }
}