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

interface NotificationRow {
  id: number;
  title: string;
  short_description: string;
  long_description: string;
  read: boolean;
  icon: string;
  created_at: string;
}

@Component({
  selector: 'app-user-notifications',
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
  templateUrl: './user-notifications.html',
  styleUrl: './user-notifications.scss',
})
export class UserNotifications implements OnInit {
  @Input() userId!: number;

  notifications: NotificationRow[] = [];
  totalNotifications = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  error: string | null = null;
  displayedColumns: string[] = ['id', 'icon', 'title', 'short_description', 'read', 'created_at'];

  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Component will be loaded dynamically, data loaded via loadNotifications()
  }

  loadNotifications(): void {
    this.loading = true;
    this.error = null;
    const token = this.loginService.getToken();

    const params = {
      page: this.pageIndex + 1,
      per_page: this.pageSize
    };

    this.internalApi.admin.notifications.getNotificationsForUser(token, this.userId, params).subscribe({
      next: (response: any) => {
        this.notifications = response.notifications || [];
        this.totalNotifications = response.pagy?.total_count || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
        this.error = 'Failed to load notifications';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadNotifications();
  }

  formatDate(date?: string | Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${displayHours}:${minutes} ${ampm}`;
  }
}
