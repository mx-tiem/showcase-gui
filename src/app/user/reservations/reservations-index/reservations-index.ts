import { Component, Input, ChangeDetectorRef, ViewChild, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort, MatSort } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { LoginService } from '../../../login/login.service';
import { InternalApiService } from '../../../shared/internal-api.service';
import { CancelConfirmationDialogComponent } from '../../home/cancel-confirmation-dialog.component';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface Reservation {
  id: number;
  machine: string;
  date: string;
  duration: string;
  durationHours: number;
  startTime: Date;
  status: string;
  createdBy: string;
  actions?: string;
}

// Constants for better performance
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const MS_PER_HOUR = 1000 * 60 * 60;

@Component({
  selector: 'app-reservations-index',
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatPaginatorModule, MatSortModule, MatDialogModule, TranslocoModule],
  templateUrl: './reservations-index.html',
  styleUrl: './reservations-index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationsIndex implements OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(MatSort) set sortSetter(sort: MatSort) {
    if (sort && !this.sort) {
      this.sort = sort;
    }
  }
  sort!: MatSort;

  @Input() set isActive(value: boolean) {
    this._isActive = value;
    if (value && !this.dataLoaded) {
      // Load without any default sorting
      this.loadReservations(1, 10, '', '');
      this.loadAppSettings();
    }
  }

  get isActive(): boolean {
    return this._isActive;
  }

  private _isActive = false;

  displayedColumns: string[] = ['machine', 'date', 'duration', 'status', 'createdBy', 'actions'];
  reservations: Reservation[] = [];
  isLoading = true;

  // Pagination properties
  totalItems = 0;
  pageSize = 10;
  currentPage = 1;

  private dataLoaded = false;
  private freeCancellationHours = 4;

  constructor(
    private loginService: LoginService,
    private internalApi: InternalApiService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formatReservation(reservation: any): Reservation {
    const startTime = new Date(reservation.start_time);
    const endTime = new Date(reservation.end_time);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = Math.round(durationMs / MS_PER_HOUR * 10) / 10;

    const formattedDate = this.formatDateTime(startTime, endTime);

    return {
      id: reservation.id,
      machine: reservation.machine?.name ?? 'Unknown Machine',
      date: formattedDate,
      duration: `${durationHours}h`,
      durationHours: durationHours,
      startTime: startTime,
      status: reservation.status ? reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1) : 'Unknown',
      createdBy: reservation.creator?.name ?? reservation.creator?.username ?? 'Unknown'
    };
  }

  private formatDateTime(startTime: Date, endTime: Date): string {
    const month = MONTH_NAMES[startTime.getMonth()];
    const day = startTime.getDate();
    const year = startTime.getFullYear();
    const startHours = startTime.getHours().toString().padStart(2, '0');
    const startMinutes = startTime.getMinutes().toString().padStart(2, '0');
    const endHours = endTime.getHours().toString().padStart(2, '0');
    const endMinutes = endTime.getMinutes().toString().padStart(2, '0');

    return `${month} ${day}, ${year} ${startHours}:${startMinutes} - ${endHours}:${endMinutes}`;
  }

  private loadReservations(page: number = 1, perPage: number = 10, sortBy?: string, sortDir?: string) {
    const token = this.loginService.getToken();
    if (!token) {
      this.handleLoadError();
      return;
    }

    this.isLoading = true;
    const params: any = { page, per_page: perPage };

    // Only add sort params if both sortBy and sortDir are provided and sortDir is not empty
    if (sortBy && sortDir && sortDir !== '') {
      params.sort_by = sortBy;
      params.sort_direction = sortDir;
    }

    this.internalApi.user.reservations.myReservations(token, params).subscribe({
      next: (response) => this.handleLoadSuccess(response),
      error: (error) => this.handleLoadError(error)
    });
  }

  private handleLoadSuccess(response: any): void {
    try {
      if (response.reservations && Array.isArray(response.reservations)) {
        this.reservations = response.reservations.map((reservation: any) => this.formatReservation(reservation));

        // Update pagination info
        if (response.pagy) {
          this.totalItems = response.pagy.total_count || 0;
          this.currentPage = response.pagy.current_page || 1;
          this.pageSize = response.pagy.per_page || 10;
        }
      } else {
        this.reservations = [];
        this.totalItems = 0;
      }
    } catch (error) {
      console.error('Error processing reservations data:', error);
      this.reservations = [];
      this.totalItems = 0;
    }

    this.isLoading = false;
    this.dataLoaded = true;
    this.cdr.markForCheck();
  }

  private handleLoadError(error?: any): void {
    if (error) {
      console.error('Error loading reservations:', error);
    }
    this.reservations = [];
    this.totalItems = 0;
    this.isLoading = false;
    this.dataLoaded = true;
    this.cdr.markForCheck();
  }

  private currentSortColumn = '';
  private currentSortDirection: 'asc' | 'desc' | '' = '';

  onSortChange(sort: Sort) {
    // Only allow sorting by start_time
    if (sort.active !== 'start_time') {
      return;
    }

    // Set the column since we're starting from no sort
    this.currentSortColumn = 'start_time';

    // Cycle the direction
    if (this.currentSortDirection === 'asc') {
      this.currentSortDirection = 'desc';
    } else if (this.currentSortDirection === 'desc') {
      this.currentSortDirection = '';
    } else {
      this.currentSortDirection = 'asc';
    }

    this.currentPage = 1; // Reset to first page when sorting
    this.loadReservations(this.currentPage, this.pageSize, this.currentSortColumn, this.currentSortDirection);

    // Update the MatSort to reflect our manual state
    if (this.sort) {
      this.sort.active = this.currentSortColumn;
      this.sort.direction = this.currentSortDirection as any;
    }
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex + 1; // Material paginator is 0-based
    this.pageSize = event.pageSize;
    // Use current sort state
    this.loadReservations(this.currentPage, this.pageSize, this.currentSortColumn, this.currentSortDirection);
  }

  onCancel(reservation: Reservation) {
    const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
      data: { reservation, freeCancellationHours: this.freeCancellationHours }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const token = this.loginService.getToken();
        if (token) {
          this.internalApi.user.reservations.cancelReservation(token, reservation.id).subscribe({
            next: (response: any) => {
              console.log('Reservation cancelled successfully', response.message);
              this.loadReservations(this.currentPage, this.pageSize, this.currentSortColumn, this.currentSortDirection);
            },
            error: (error) => {
              console.error('Error cancelling reservation:', error);
            }
          });
        }
      }
    });
  }

  private loadAppSettings() {
    const token = this.loginService.getToken();
    if (token) {
      this.internalApi.user.appSettings(token).subscribe({
        next: (response: any) => {
          this.freeCancellationHours = response.free_cancellation_hours ?? 4;
        },
        error: (error) => {
          console.error('Error loading app settings:', error);
        }
      });
    }
  }

  trackByReservationId(index: number, reservation: Reservation): number {
    return reservation.id;
  }
}