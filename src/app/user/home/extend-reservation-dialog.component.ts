import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-extend-reservation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatSliderModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Extend Reservation</h2>
    <mat-dialog-content>
      <div class="extend-info">
        <div class="info-row">
          <span class="info-label">Machine</span>
          <span class="info-value">{{ data.reservation.machine }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Current End</span>
          <span class="info-value">{{ data.currentEndTime }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Available Playhours</span>
          <span class="info-value">{{ data.availablePlayhours }}h</span>
        </div>
      </div>

      <div *ngIf="data.maxExtendHours > 0" class="extend-controls">
        <div class="slider-label">Extend by: <strong>{{ selectedHours }}h</strong></div>
        <mat-slider
          [min]="0.5"
          [max]="data.maxExtendHours"
          [step]="0.5"
          discrete
          showTickMarks
          class="extend-slider">
          <input matSliderThumb [(ngModel)]="selectedHours">
        </mat-slider>
        <div class="new-end-time">
          <mat-icon>schedule</mat-icon>
          <span>New end time: <strong>{{ getNewEndTime() }}</strong></span>
        </div>
      </div>

      <div *ngIf="data.maxExtendHours <= 0" class="no-extend">
        <mat-icon>block</mat-icon>
        <span>This reservation cannot be extended further.</span>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="center">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="data.maxExtendHours <= 0"
        [mat-dialog-close]="selectedHours"
        style="font-size: 18px;">
        Extend by {{ selectedHours }}h
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      overflow-x: hidden;
    }
    ::ng-deep .mat-mdc-dialog-content {
      overflow-x: hidden;
    }
    .extend-info {
      margin-bottom: 24px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-size: 16px;
    }
    .info-label {
      color: rgba(255,255,255,0.6);
    }
    .info-value {
      font-weight: 500;
    }
    .extend-controls {
      text-align: center;
      padding: 16px 0;
    }
    .slider-label {
      font-size: 20px;
      margin-bottom: 12px;
    }
    .extend-slider {
      width: calc(100% - 16px);
      margin: 0 8px;
    }
    .new-end-time {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px 16px;
      background-color: rgba(76, 175, 80, 0.15);
      border-radius: 8px;
      font-size: 18px;
      color: #a5d6a7;
      border: 1px solid rgba(76, 175, 80, 0.3);
    }
    .no-extend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px;
      background-color: rgba(183, 28, 28, 0.15);
      border-radius: 8px;
      font-size: 18px;
      color: #ef9a9a;
      border: 1px solid rgba(211, 47, 47, 0.3);
    }
  `]
})
export class ExtendReservationDialogComponent implements OnInit {
  selectedHours = 1;

  constructor(
    public dialogRef: MatDialogRef<ExtendReservationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      reservation: any;
      currentEndTime: string;
      currentEndDate: Date;
      maxExtendHours: number;
      availablePlayhours: number;
    }
  ) {}

  ngOnInit() {
    this.selectedHours = Math.min(1, this.data.maxExtendHours);
  }

  getNewEndTime(): string {
    const newEnd = new Date(this.data.currentEndDate.getTime() + this.selectedHours * 3600 * 1000);
    const hours = newEnd.getHours().toString().padStart(2, '0');
    const minutes = newEnd.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
