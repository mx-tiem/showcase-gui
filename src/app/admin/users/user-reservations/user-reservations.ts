import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';

interface Reservation {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string;
  machine?: {
    id: number;
    name: string;
    machine_type?: string;
    status?: string;
  };
  user?: {
    id: number;
    email: string;
    name: string;
    role?: string;
  };
}

@Component({
  selector: 'app-user-reservations',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    TranslocoModule
  ],
  templateUrl: './user-reservations.html',
  styleUrl: './user-reservations.scss',
})
export class UserReservations implements OnInit {
  @Input() userId!: number;
  
  reservations: Reservation[] = [];
  totalReservations = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  error: string | null = null;
  displayedColumns: string[] = ['id', 'machine', 'start_time', 'end_time', 'duration', 'status'];
  
  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    // Component will be loaded dynamically, data loaded via loadReservations()
  }
  
  loadReservations(): void {
    this.loading = true;
    this.error = null;
    const token = this.loginService.getToken();
    
    const params = {
      page: this.pageIndex + 1,
      per_page: this.pageSize,
      sort_by: 'start_time',
      sort_direction: 'desc'
    };
    
    this.internalApi.admin.reservations.reservationsForUser(token, this.userId, params).subscribe({
      next: (response: any) => {
        this.reservations = Array.isArray(response) ? response : (response.reservations || []);
        this.totalReservations = Array.isArray(response) ? response.length : (response.pagy?.total_count || 0);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.error = 'Failed to load reservations';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadReservations();
  }
  
  formatDate(date?: string | Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${displayHours}:${minutes}:${seconds} ${ampm}`;
  }
  
  getDuration(reservation: Reservation): number {
    if (!reservation.start_time || !reservation.end_time) return 0;
    const start = new Date(reservation.start_time);
    const end = new Date(reservation.end_time);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60)); // Duration in minutes
  }
  
  formatDuration(reservation: Reservation): string {
    const duration = this.getDuration(reservation);
    if (!duration) return 'N/A';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }
  
  getMachineName(reservation: Reservation): string {
    return reservation.machine?.name || `Machine #${reservation.machine?.id}` || 'N/A';
  }
}
