import { Component, signal, Injectable, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { InternalApiService } from '../../shared/internal-api.service';
import { parseApiDateTime } from '../../shared/date-utils';
import { LoginService } from '../../login/login.service';
import { AdminDialog, AdminDialogData } from '../admin-dialog/admin-dialog';
import { 
  CalendarView, 
  CalendarEvent, 
  CalendarMonthViewComponent,
  CalendarWeekViewComponent,
  CalendarDayViewComponent,
  CalendarDatePipe,
  CalendarPreviousViewDirective,
  CalendarTodayDirective,
  CalendarNextViewDirective,
  provideCalendar,
  DateAdapter,
  CalendarDateFormatter,
  DateFormatterParams
} from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { format, startOfWeek, endOfWeek, startOfDay, startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
class CustomDateFormatter extends CalendarDateFormatter {
  public override weekViewHour({ date }: DateFormatterParams): string {
    return format(date, 'HH:mm');
  }

  public override dayViewHour({ date }: DateFormatterParams): string {
    return format(date, 'HH:mm');
  }
}

@Component({
  selector: 'app-calendar',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatTooltipModule,
    FormsModule,
    RouterModule,
    TranslocoModule,
    CalendarMonthViewComponent,
    CalendarWeekViewComponent,
    CalendarDayViewComponent,
    CalendarDatePipe,
    CalendarPreviousViewDirective,
    CalendarTodayDirective,
    CalendarNextViewDirective
  ],
  providers: [
    provideCalendar({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    { provide: CalendarDateFormatter, useClass: CustomDateFormatter }
  ],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar implements OnInit, AfterViewInit {
  CalendarView = CalendarView;
  view: CalendarView = CalendarView.Week;
  viewDate: Date = new Date();
  
  machines = signal<any[]>([]);
  users = signal<any[]>([]);
  selectedMachineId = signal<number | null>(null);
  userSearchTerm = signal<string>('');
  selectedUserId = signal<number | null>(null);
  
  events = signal<CalendarEvent[]>([]);

  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private elementRef: ElementRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadMachines();
    this.loadUsers();
    this.loadReservations();
  }

  ngAfterViewInit(): void {
    // Scroll to 11:00 after view is initialized
    setTimeout(() => this.scrollToTime(11), 100);
  }

  scrollToTime(hour: number): void {
    const calendarElement = this.elementRef.nativeElement.querySelector('.cal-time-events');
    if (calendarElement) {
      // Each hour is typically 60px tall (this may vary based on styling)
      const hourHeight = 60;
      const scrollPosition = hour * hourHeight;
      calendarElement.scrollTop = scrollPosition;
    }
  }

  loadReservations(): void {
    const token = this.loginService.getToken();
    const machineId = this.selectedMachineId();
    const userId = this.selectedUserId();

    if (machineId) {
      // Load reservations for specific machine
      this.internalApi.admin.reservations.reservationsForMachine(token, machineId).subscribe({
        next: (response: any) => {
          // Handle both array and object responses
          const reservations = Array.isArray(response) ? response : [];
          this.events.set(this.convertReservationsToEvents(reservations));
        },
        error: (error) => {
          console.error('Error loading reservations for machine:', error);
          this.events.set([]);
        }
      });
    } else if (userId) {
      // Load reservations for specific user with date range based on view
      let params: { start_date: string; end_date: string };
      
      if (this.view === CalendarView.Day) {
        // For day view, use the same date for start and end
        const dayDate = format(this.viewDate, 'yyyy-MM-dd');
        params = {
          start_date: dayDate,
          end_date: dayDate
        };
      } else if (this.view === CalendarView.Month) {
        // For month view, use month boundaries
        const monthStart = startOfMonth(this.viewDate);
        const monthEnd = endOfMonth(this.viewDate);
        params = {
          start_date: format(monthStart, 'yyyy-MM-dd'),
          end_date: format(monthEnd, 'yyyy-MM-dd')
        };
      } else {
        // For week view, use week boundaries
        const weekStart = startOfWeek(this.viewDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(this.viewDate, { weekStartsOn: 1 });
        params = {
          start_date: format(weekStart, 'yyyy-MM-dd'),
          end_date: format(weekEnd, 'yyyy-MM-dd')
        };
      }
      
      this.internalApi.admin.reservations.calendarReservationsForUser(token, userId, params).subscribe({
        next: (response: any) => {
          const reservations = Array.isArray(response) ? response : [];
          this.events.set(this.convertReservationsToEvents(reservations));
        },
        error: (error) => {
          console.error('Error loading reservations for user:', error);
          this.events.set([]);
        }
      });
    } else {
      // Load all reservations when no filter is selected
      this.internalApi.admin.reservations.getReservations(token, { per_page: 1000 }).subscribe({
        next: (response: any) => {
          const reservations = response.reservations || [];
          this.events.set(this.convertReservationsToEvents(reservations));
        },
        error: (error) => {
          console.error('Error loading reservations:', error);
          this.events.set([]);
        }
      });
    }
  }

  convertReservationsToEvents(reservations: any[]): CalendarEvent[] {
    return reservations.map(reservation => {
      const startDate = parseApiDateTime(reservation.start_time);
      const endDate = parseApiDateTime(reservation.end_time);
      
      const start = startDate;
      const end = endDate;
      
      // Format times for display
      const startTime = format(startDate, 'HH:mm');
      const endTime = format(endDate, 'HH:mm');
      const status = reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1);
      
      return {
        start,
        end,
        title: `${reservation.user?.name || 'Unknown'} - ${reservation.machine?.name || 'Unknown'}\nStatus: ${status}\n${startTime}h -> ${endTime}h`,
        color: this.getColorForStatus(reservation.status),
        meta: reservation,
        cssClass: 'clickable-event'
      };
    });
  }

  getColorForStatus(status: string): { primary: string; secondary: string } {
    const colors: { [key: string]: { primary: string; secondary: string } } = {
      'start': { primary: '#FFA500', secondary: '#FFE0B2' },
      'confirmed': { primary: '#1e90ff', secondary: '#D1E8FF' },
      'active': { primary: '#4CAF50', secondary: '#C8E6C9' },
      'done': { primary: '#9E9E9E', secondary: '#E0E0E0' },
      'cancelled': { primary: '#F44336', secondary: '#FFCDD2' }
    };
    return colors[status] || colors['confirmed'];
  }

  loadMachines(): void {
    const token = this.loginService.getToken();
    this.internalApi.admin.machines.getMachines(token, { per_page: 1000 }).subscribe({
      next: (response: any) => {
        this.machines.set(response.machines || []);
      },
      error: (error) => {
        console.error('Error loading machines:', error);
      }
    });
  }

  loadUsers(): void {
    const token = this.loginService.getToken();
    this.internalApi.admin.users.getUsers(token, { per_page: 1000 }).subscribe({
      next: (response: any) => {
        this.users.set(response.users || []);
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  onMachineChange(machineId: number): void {
    this.selectedMachineId.set(machineId);
    this.selectedUserId.set(null);
    this.userSearchTerm.set('');
    this.loadReservations();
  }

  onUserSearch(): void {
    // This method is just for filtering the autocomplete list
    // loadReservations() is called only when a user is actually selected via selectUser()
  }

  get filteredUsers() {
    const searchTerm = this.userSearchTerm().toLowerCase();
    if (!searchTerm) return [];
    return this.users().filter(u => 
      u.name.toLowerCase().includes(searchTerm) || 
      u.email.toLowerCase().includes(searchTerm)
    ).slice(0, 10);
  }

  selectUser(user: any): void {
    this.selectedUserId.set(user.id);
    this.userSearchTerm.set(user.name);
    this.selectedMachineId.set(null);
    this.loadReservations();
  }

  clearFilters(): void {
    this.selectedMachineId.set(null);
    this.selectedUserId.set(null);
    this.userSearchTerm.set('');
    this.loadReservations();
  }

  setView(view: CalendarView) {
    this.view = view;
    // Reload reservations when view changes
    this.loadReservations();
    // Scroll to 11:00 when switching views
    setTimeout(() => this.scrollToTime(11), 100);
  }

  onViewDateChange() {
    // Reload reservations when navigating to different dates
    this.loadReservations();
  }

  handleEventClick(event: CalendarEvent): void {
    console.log('Event clicked:', event);
    const reservationId = event.meta?.id;
    console.log('Reservation ID:', reservationId);
    if (!reservationId) {
      console.error('No reservation ID found in event meta');
      return;
    }

    const token = this.loginService.getToken();
    this.internalApi.admin.reservations.showReservation(token, reservationId).subscribe({
      next: (reservation: any) => {
        console.log('Loaded reservation:', reservation);
        
        // Format datetime for datetime-local input (without timezone conversion)
        const formatDateTimeLocal = (dateTimeString: string): string => {
          const date = new Date(dateTimeString);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        const dialogData: AdminDialogData = {
          mode: 'view',
          resourceType: 'reservations',
          title: 'View Reservation',
          data: reservation,
          fields: [
            { key: 'id', label: 'ID', type: 'number', value: reservation.id, readonly: true },
            { key: 'user', label: 'User', type: 'text', value: reservation.user?.name || 'N/A', readonly: true },
            { key: 'machine', label: 'Machine', type: 'text', value: reservation.machine?.name || 'N/A', readonly: true },
            { key: 'start_time', label: 'Start Time', type: 'datetime-local', value: formatDateTimeLocal(reservation.start_time), readonly: true },
            { key: 'end_time', label: 'End Time', type: 'datetime-local', value: formatDateTimeLocal(reservation.end_time), readonly: true },
            { key: 'status', label: 'Status', type: 'text', value: reservation.status, readonly: true },
            { key: 'notes', label: 'Notes', type: 'textarea', value: reservation.notes || '', readonly: true }
          ]
        };

        this.dialog.open(AdminDialog, {
          width: '600px',
          data: dialogData
        });
      },
      error: (error) => {
        console.error('Error loading reservation:', error);
      }
    });
  }

  closeOpenMonthViewDay() {
    // Implement if needed for month view
  }
}
