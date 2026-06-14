import { Component, OnInit, OnChanges, SimpleChanges, Input, ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LoginService } from '../../login/login.service';
import { InternalApiService } from '../../shared/internal-api.service';
import { CancelConfirmationDialogComponent } from './cancel-confirmation-dialog.component';
import { ExtendReservationDialogComponent } from './extend-reservation-dialog.component';
import { Machines } from './machines/machines';
import { TranslocoModule } from '@jsverse/transloco';
import { SquareButton } from '../../shared/buttons/square-button/square-button';

export interface Reservation {
  id: number;
  machine: string;
  date: string; // will now include time
  duration: string;
  durationHours: number;
  startTime: Date;
  endTime: Date;
  status: string;
  createdBy: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, MatButtonModule, MatTableModule, MatIconModule, MatDialogModule, MatCardModule, Machines, TranslocoModule, SquareButton],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnChanges {
  @Input() set isActive(value: boolean) {
    this._isActive = value;
    if (value && !this.dataLoaded && !this.isLoadingData) {
      this.loadData();
    }
  }

  get isActive(): boolean {
    return this._isActive;
  }

  private _isActive = false;
  
  playHours: number | null = null;
  isLoading = true;
  displayedColumns: string[] = ['machine', 'date', 'duration', 'status', 'createdBy', 'actions'];
  activeReservations: Reservation[] = [];
  freeCancellationHours: number = 4;

  get hasActiveReservation(): boolean {
    return this.activeReservations.some(r => r.status === 'Active');
  }

  get firstActiveReservation(): Reservation | undefined {
    return this.activeReservations.find(r => r.status === 'Active');
  }

  private dataLoaded = false;
  private isLoadingData = false;

  constructor(
    private loginService: LoginService,
    private internalApi: InternalApiService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    // Data loading is handled by the isActive setter
  }

  ngOnChanges(changes: SimpleChanges) {
    // Data loading is handled by the isActive setter
  }

  private loadData() {
    if (this.isLoadingData) {
      return;
    }
    
    this.isLoadingData = true;
    const token = this.loginService.getToken();
    if (token) {
      // Load current user data for hours
      this.internalApi.user.currentUser(token).subscribe({
        next: (response) => {
          try {
            // Update hours
            this.playHours = response.available_playhours ?? 0;
            this.cdr.detectChanges();
          } catch (error) {
            console.error('Error processing current user data:', error);
          }
        },
        error: (error) => {
          console.error('Error loading current user data:', error);
          this.isLoadingData = false;
        }
      });

      // Load app settings for free cancellation hours
      this.internalApi.user.appSettings(token).subscribe({
        next: (response: any) => {
          this.freeCancellationHours = response.free_cancellation_hours ?? 4;
        },
        error: (error) => {
          console.error('Error loading app settings:', error);
        }
      });

      // Load active reservations (confirmed + active only)
      this.internalApi.user.reservations.activeReservations(token).subscribe({
        next: (response) => {
          try {
            // Update reservations
            if (response.reservations) {
              this.activeReservations = response.reservations.map((item: any) => {
                const startTime = new Date(item.start_time);
                const endTime = new Date(item.end_time);
                const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                
                // Format date as "Jan 5 16:00" in Europe/Zagreb timezone
                const parts = new Intl.DateTimeFormat('en-US', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                  hour12: false, timeZone: 'Europe/Zagreb'
                }).formatToParts(startTime);
                const get = (type: string) => parts.find(p => p.type === type)?.value || '';
                const formattedDate = `${get('month')} ${get('day')} ${get('hour')}:${get('minute')}`;
                
                return {
                  id: item.id,
                  machine: item.machine?.name ?? 'Unknown Machine',
                  date: formattedDate,
                  duration: `${durationHours}h`,
                  durationHours: durationHours,
                  startTime: startTime,
                  endTime: endTime,
                  status: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown',
                  createdBy: item.creator?.name ?? item.creator?.username ?? 'Unknown'
                };
              });
            } else {
              this.activeReservations = [];
            }
            this.isLoading = false;
            this.dataLoaded = true;
            this.isLoadingData = false;
            this.cdr.detectChanges();
          } catch (error) {
            console.error('Error processing reservations data:', error);
            this.isLoading = false;
            this.isLoadingData = false;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error loading reservations:', error);
          this.isLoading = false;
          this.isLoadingData = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isLoading = false;
      this.isLoadingData = false;
      this.cdr.detectChanges();
    }
  }

  onPlay() {
    this.router.navigate(['/reservations/new']);
  }

  navigateToNewReservation() {
    sessionStorage.setItem('skipCubeAnimation', 'true');
    this.router.navigate(['/reservations/new']);
  }


  onCancel(reservation: Reservation) {
    const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
      data: { reservation, freeCancellationHours: this.freeCancellationHours }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // User confirmed cancellation
        const token = this.loginService.getToken();
        if (token) {
          this.internalApi.user.reservations.cancelReservation(token, reservation.id).subscribe({
            next: (response: any) => {
              console.log('Reservation cancelled successfully', response.message);
              this.dataLoaded = false;
              this.loadData(); // Reload data to reflect changes
            },
            error: (error) => {
              console.error('Error cancelling reservation:', error);
            }
          });
        }
      }
    });
  }

  onExtend(reservation?: Reservation) {
    const target = reservation || this.firstActiveReservation;
    if (!target) return;

    const token = this.loginService.getToken();
    if (!token) return;

    // First fetch max extend info from backend
    this.internalApi.user.reservations.getMaxExtend(token, target.id).subscribe({
      next: (response: any) => {
        const currentEndDate = new Date(response.current_end_time);
        const endHours = currentEndDate.getHours().toString().padStart(2, '0');
        const endMinutes = currentEndDate.getMinutes().toString().padStart(2, '0');
        const currentEndTimeStr = `${endHours}:${endMinutes}`;

        const dialogRef = this.dialog.open(ExtendReservationDialogComponent, {
          width: '550px',
          data: {
            reservation: target,
            currentEndTime: currentEndTimeStr,
            currentEndDate: currentEndDate,
            maxExtendHours: response.max_extend_hours,
            availablePlayhours: response.available_playhours
          }
        });

        dialogRef.afterClosed().subscribe(extendHours => {
          if (extendHours && extendHours > 0) {
            this.internalApi.user.reservations.extendReservation(token, target.id, extendHours).subscribe({
              next: (res: any) => {
                console.log('Reservation extended successfully', res.message);
                this.dataLoaded = false;
                this.loadData();
              },
              error: (error: any) => {
                console.error('Error extending reservation:', error);
              }
            });
          }
        });
      },
      error: (error: any) => {
        console.error('Error fetching max extend info:', error);
      }
    });
  }
}
