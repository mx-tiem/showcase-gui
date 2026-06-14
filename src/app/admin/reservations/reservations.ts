import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';
import { AdminDialog, AdminDialogData, DialogField, DialogResult } from '../admin-dialog/admin-dialog';
import { Wizard, WizardData } from './wizard/wizard';
import { ShowDialog } from './dialogs/show-dialog/show-dialog';
import { DeleteDialog } from './dialogs/delete-dialog/delete-dialog';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { TranslocoService } from '@jsverse/transloco';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface Reservation {
  id: number;
  user_id: number;
  machine_id: number;
  start_time: Date;
  end_time: Date;
  status: string;
  notes?: string;
  user: {name: string, id: number};
  machine: {name: string, id: number};
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [AdminTable, MatButtonModule],
  templateUrl: './reservations.html',
  styleUrl: './reservations.scss',
})
export class Reservations implements OnInit {
  reservations: Reservation[] = [];
  totalReservations = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  
  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.reservations.columns.id'), sortable: true, cssClass: 'id-column' },
    { 
      key: 'user', 
      label: marker('admin.reservations.columns.user'), 
      sortable: true,
      format: (value: any) => value?.name || 'N/A'
    },
    { 
      key: 'machine', 
      label: marker('admin.reservations.columns.machine'), 
      sortable: true,
      format: (value: any) => value?.name || 'N/A'
    },
    { 
      key: 'start_time', 
      label: marker('admin.reservations.columns.startTime'), 
      sortable: true,
      format: (value: string) => {
        const date = new Date(value);
        return date.toLocaleString('en-US', { 
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Zagreb'
        });
      }
    },
    { 
      key: 'end_time', 
      label: marker('admin.reservations.columns.endTime'), 
      sortable: true,
      format: (value: string) => {
        const date = new Date(value);
        return date.toLocaleString('en-US', { 
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Zagreb'
        });
      }
    },
    { key: 'status', label: marker('admin.reservations.columns.status'), sortable: true, cellClass: (value: any) => `status-${(value || '').toLowerCase()}` },
    { key: 'actions', label: marker('admin.reservations.columns.actions'), sortable: false, isActions: true, cssClass: 'actions-column' }
  ];
  
  currentSort: TableSortEvent = { active: '', direction: '' };
  
  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}
  
  ngOnInit(): void {
    this.loadReservations();
  }
  
  loadReservations(): void {
    this.loading = true;
    const token = this.loginService.getToken();
    
    const params: any = {
      page: this.pageIndex + 1,
      per_page: this.pageSize
    };
    
    if (this.currentSort.active && this.currentSort.direction) {
      params.sort_by = this.currentSort.active;
      params.sort_direction = this.currentSort.direction;
    }
    
    this.internalApi.admin.reservations.getReservations(token, params).subscribe({
      next: (response: any) => {
        this.reservations = response.reservations;
        this.totalReservations = response.pagy.total_count;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.loading = false;
        this.reservations = [];
        this.totalReservations = 0;
        this.cdr.detectChanges();
      }
    });
  }
  
  onSortChange(event: TableSortEvent): void {
    this.currentSort = event;
    this.pageIndex = 0;
    this.loadReservations();
  }
  
  onPageChange(event: TablePaginationEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadReservations();
  }
  
  onActionClick(event: TableActionEvent): void {
    const reservation = event.row as Reservation;
    
    switch (event.action) {
      case 'view':
        this.openViewDialog(reservation);
        break;
    }
  }
  
  onCreateReservation(): void {
    const wizardData: WizardData = {
      mode: 'create'
    };
    
    const dialogRef = this.dialog.open(Wizard, {
      width: '80vw',
      maxWidth: '80vw',
      height: '90vh',
      data: wizardData
    });
    
    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.action === 'save') {
        this.createReservation(result.data);
      }
    });
  }
  
  private getReservationFields(reservation: Reservation): DialogField[] {
    // Format datetime for datetime-local input
    const formatDateTimeLocal = (dateTimeString: string | Date): string => {
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Europe/Zagreb'
      }).formatToParts(date);
      const get = (type: string) => parts.find(p => p.type === type)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
    };
    
    return [
      { 
        key: 'user_id', 
        label: 'User ID', 
        type: 'number', 
        value: reservation.user_id, 
        required: true 
      },
      { 
        key: 'machine_id', 
        label: 'Machine ID', 
        type: 'number', 
        value: reservation.machine_id, 
        required: true 
      },
      { 
        key: 'start_time', 
        label: 'Start Time', 
        type: 'datetime-local', 
        value: formatDateTimeLocal(reservation.start_time), 
        required: true 
      },
      { 
        key: 'end_time', 
        label: 'End Time', 
        type: 'datetime-local', 
        value: formatDateTimeLocal(reservation.end_time), 
        required: true 
      },
      { 
        key: 'status', 
        label: 'Status', 
        type: 'select', 
        value: reservation.status, 
        required: true,
        options: [
          { value: 'start', label: 'Start' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'active', label: 'Active' },
          { value: 'done', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      },
      { key: 'notes', label: 'Notes', type: 'textarea', value: reservation.notes, placeholder: 'Enter notes...' }
    ];
  }
  
  private createReservation(data: any): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.reservations.createReservation(token, data).subscribe({
      next: (response) => {
        console.log('Reservation created successfully:', response);
        this.loadReservations();
      },
      error: (error) => {
        console.error('Error creating reservation:', error);
        alert('Failed to create reservation. Please try again.');
      }
    });
  }
  
  private openViewDialog(reservation: Reservation): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.reservations.showReservation(token, reservation.id).subscribe({
      next: (response: any) => {
        const freshReservation = response.reservation || response;
        
        const dialogRef = this.dialog.open(ShowDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: freshReservation
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (!result) return;

          if (result.action === 'cancel') {
            this.openCancelDialog(freshReservation);
          } else if (result.action === 'update_status') {
            this.updateReservationStatus(freshReservation.id, result.status);
          }
        });
      },
      error: (error) => {
        console.error('Error loading reservation details:', error);
        alert('Failed to load reservation details. Please try again.');
      }
    });
  }

  private openCancelDialog(reservation: any): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.appSettings.getSettings(token).subscribe({
      next: (response: any) => {
        const settings = response.app_setting || response;
        const freeCancellationHours = settings.free_cancellation_hours ?? 4;

        const dialogRef = this.dialog.open(DeleteDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: { reservation, freeCancellationHours }
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result && result.action === 'cancel') {
            this.cancelReservation(reservation.id, result.refund);
          }
        });
      },
      error: (error) => {
        console.error('Error loading app settings:', error);
        alert('Failed to load app settings. Please try again.');
      }
    });
  }

  private cancelReservation(reservationId: number, refund: boolean): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.reservations.cancelReservation(token, reservationId, refund).subscribe({
      next: (response) => {
        console.log('Reservation cancelled successfully:', response);
        this.loadReservations();
      },
      error: (error) => {
        console.error('Error cancelling reservation:', error);
        alert('Failed to cancel reservation. Please try again.');
      }
    });
  }

  private updateReservationStatus(reservationId: number, status: string): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.reservations.updateStatus(token, reservationId, status).subscribe({
      next: (response) => {
        console.log('Reservation status updated successfully:', response);
        this.loadReservations();
      },
      error: (error) => {
        console.error('Error updating reservation status:', error);
        alert('Failed to update reservation status. Please try again.');
      }
    });
  }
  
  private fetchReservationData(reservationId: number): Promise<any> {
    const token = this.loginService.getToken();
    
    return new Promise((resolve, reject) => {
      this.internalApi.admin.reservations.showReservation(token, reservationId).subscribe({
        next: (response: any) => {
          const freshReservation = response.reservation || response;
          resolve(freshReservation);
        },
        error: (error) => {
          console.error('Error fetching reservation data:', error);
          reject(error);
        }
      });
    });
  }
}
