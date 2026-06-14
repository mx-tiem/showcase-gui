import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface NotificationRow {
  id: number;
  title: string;
  short_description: string;
  long_description: string;
  read: boolean;
  icon: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [AdminTable],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AdminNotifications implements OnInit {
  notifications: NotificationRow[] = [];
  totalNotifications = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  currentSort: TableSortEvent = { active: '', direction: '' };

  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.notifications.columns.id'), sortable: true, cssClass: 'id-column' },
    { key: 'user_name', label: marker('admin.notifications.columns.user'), sortable: false },
    { key: 'icon', label: marker('admin.notifications.columns.icon'), sortable: false },
    { key: 'title', label: marker('admin.notifications.columns.title'), sortable: true },
    { key: 'short_description', label: marker('admin.notifications.columns.description'), sortable: false },
    {
      key: 'read', label: marker('admin.notifications.columns.status'), sortable: true,
      format: (value: any) => value ? 'Read' : 'Unread',
      cellClass: (value: any) => value ? 'status-done' : 'status-active'
    },
    {
      key: 'created_at', label: marker('admin.notifications.columns.createdAt'), sortable: true,
      format: (value: any) => {
        if (!value) return 'N/A';
        const d = new Date(value);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${month}/${day}/${year}, ${displayHours}:${minutes} ${ampm}`;
      }
    },
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
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

    this.internalApi.admin.notifications.getNotifications(token, params).subscribe({
      next: (response: any) => {
        this.notifications = (response.notifications || []).map((n: any) => ({
          ...n,
          user_name: n.user?.name || 'N/A'
        }));
        this.totalNotifications = response.pagy?.total_count || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
        this.notifications = [];
        this.totalNotifications = 0;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSortChange(event: TableSortEvent): void {
    this.currentSort = event;
    this.pageIndex = 0;
    this.loadNotifications();
  }

  onPageChange(event: TablePaginationEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadNotifications();
  }

  onActionClick(event: TableActionEvent): void {
    // View/edit/delete can be added later
  }
}
