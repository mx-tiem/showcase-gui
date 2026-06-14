import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent } from '../../interfaces/table-column.interface';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface HourTransaction {
  id: number;
  hours_amount: number;
  transaction_type: string;
  notice: string;
  created_at: string;
  updated_at: string;
  sender: User;
  receiver: User;
}

@Component({
  selector: 'app-hour-transactions',
  standalone: true,
  imports: [AdminTable],
  templateUrl: './hour-transactions.html',
  styleUrl: './hour-transactions.scss',
})
export class HourTransactions implements OnInit {
  transactions: HourTransaction[] = [];
  totalTransactions = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  
  currentSort: TableSortEvent = { active: 'id', direction: 'desc' };
  
  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.hourTransactions.columns.id'), sortable: true, cssClass: 'id-column' },
    { 
      key: 'sender', 
      label: marker('admin.hourTransactions.columns.sender'), 
      sortable: false,
      format: (value: User) => value?.name || '-'
    },
    { 
      key: 'receiver', 
      label: marker('admin.hourTransactions.columns.receiver'), 
      sortable: false,
      format: (value: User) => value?.name || '-'
    },
    { 
      key: 'hours_amount', 
      label: marker('admin.hourTransactions.columns.hours'), 
      sortable: true,
      format: (value: number) => value?.toString() || '0'
    },
    { key: 'transaction_type', label: marker('admin.hourTransactions.columns.type'), sortable: true },
    { key: 'notice', label: marker('admin.hourTransactions.columns.notice'), sortable: false },
    { 
      key: 'created_at', 
      label: marker('admin.hourTransactions.columns.date'), 
      sortable: true,
      format: (value: string) => {
        if (!value) return '';
        const d = new Date(value);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${month}/${day}/${year}, ${hours}:${minutes}`;
      }
    }
  ];
  
  constructor(
    private cdr: ChangeDetectorRef,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}
  
  ngOnInit(): void {
    this.loadTransactions();
  }
  
  loadTransactions(): void {
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
    
    this.internalApi.admin.hourTransactions.getTransactions(token, params).subscribe({
      next: (response: any) => {
        this.transactions = response.hour_transactions || [];
        this.totalTransactions = response.pagy?.total_count || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading hour transactions:', error);
        this.loading = false;
        this.transactions = [];
        this.totalTransactions = 0;
        this.cdr.detectChanges();
      }
    });
  }
  
  onSortChange(event: TableSortEvent): void {
    this.currentSort = event;
    this.pageIndex = 0;
    this.loadTransactions();
  }
  
  onPageChange(event: TablePaginationEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTransactions();
  }
}
