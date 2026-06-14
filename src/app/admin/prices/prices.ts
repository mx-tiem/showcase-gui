import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';
import { AdminDialog, AdminDialogData, DialogField, DialogResult } from '../admin-dialog/admin-dialog';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface Price {
  id: number;
  name: string;
  description: string;
  price: number;
  amount: number;
  hours_type: string;
  active: boolean;
  currency: string;
  sort_order: number;
}

@Component({
  selector: 'app-prices',
  standalone: true,
  imports: [AdminTable, MatButtonModule],
  templateUrl: './prices.html',
  styleUrl: './prices.scss',
})
export class Prices implements OnInit {
  prices: Price[] = [];
  totalPrices = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;

  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.prices.columns.id'), sortable: true, cssClass: 'id-column' },
    { key: 'name', label: marker('admin.prices.columns.name'), sortable: true },
    { key: 'price', label: marker('admin.prices.columns.price'), sortable: true, format: (v: any, row: any) => `${v} ${row.currency}` },
    { key: 'amount', label: marker('admin.prices.columns.hours'), sortable: true },
    { key: 'avg_price', label: marker('admin.prices.columns.avg'), sortable: false, format: (_v: any, row: any) => `${(row.price / row.amount).toFixed(2)} ${row.currency}/h` },
    { key: 'hours_type', label: marker('admin.prices.columns.type'), sortable: true },
    { key: 'active', label: marker('admin.prices.columns.active'), sortable: true },
    { key: 'sort_order', label: marker('admin.prices.columns.order'), sortable: true },
    { key: 'actions', label: marker('admin.prices.columns.actions'), sortable: false, isActions: true, cssClass: 'actions-column' }
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}

  ngOnInit(): void {
    this.loadPrices();
  }

  loadPrices(): void {
    this.loading = true;
    const token = this.loginService.getToken();

    const params = {
      page: this.pageIndex + 1,
      per_page: this.pageSize
    };

    this.internalApi.admin.prices.getPrices(token, params).subscribe({
      next: (response: any) => {
        this.prices = response.prices;
        this.totalPrices = response.pagy.total_count;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading prices:', error);
        this.prices = [];
        this.totalPrices = 0;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSortChange(event: TableSortEvent): void {
    console.log('Sort change:', event);
  }

  onPageChange(event: TablePaginationEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPrices();
  }

  onActionClick(event: TableActionEvent): void {
    const price = event.row as Price;

    switch (event.action) {
      case 'view':
        this.viewPrice(price);
        break;
      case 'edit':
        this.editPrice(price);
        break;
      case 'delete':
        this.deletePrice(price);
        break;
    }
  }

  onCreatePrice(): void {
    const emptyPrice: Partial<Price> = {
      name: '',
      description: '',
      price: 0,
      amount: 1,
      hours_type: 'playhours',
      active: true,
      currency: 'EUR',
      sort_order: 0
    };

    const dialogData: AdminDialogData = {
      mode: 'create',
      resourceType: 'prices',
      title: 'Create New Price',
      fields: this.getPriceFields(emptyPrice as Price)
    };

    const dialogRef = this.dialog.open(AdminDialog, {
      width: '70vw',
      height: '80vh',
      maxWidth: '1200px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: DialogResult) => {
      if (result && result.action === 'save') {
        this.createPrice(result.data);
      }
    });
  }

  private getPriceFields(price: Price): DialogField[] {
    return [
      { key: 'name', label: 'Name', type: 'text', value: price.name, required: true },
      { key: 'description', label: 'Description', type: 'textarea', value: price.description },
      { key: 'price', label: 'Price', type: 'number', value: price.price, required: true },
      { key: 'amount', label: 'Hours Amount', type: 'number', value: price.amount, required: true },
      {
        key: 'hours_type',
        label: 'Hours Type',
        type: 'select',
        value: price.hours_type,
        required: true,
        options: [
          { value: 'playhours', label: 'Play Hours' },
          { value: 'event', label: 'Event' },
          { value: 'private', label: 'Private' }
        ]
      },
      {
        key: 'active',
        label: 'Active',
        type: 'select',
        value: price.active,
        options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' }
        ]
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'select',
        value: price.currency,
        required: true,
        options: [
          { value: 'EUR', label: 'EUR' },
          { value: 'USD', label: 'USD' },
          { value: 'GBP', label: 'GBP' }
        ]
      },
      { key: 'sort_order', label: 'Sort Order', type: 'number', value: price.sort_order }
    ];
  }

  private viewPrice(price: Price): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.prices.showPrice(token, price.id).subscribe({
      next: (freshPrice: any) => {
        const dialogData: AdminDialogData = {
          mode: 'view',
          resourceType: 'prices',
          title: `View Price - ${freshPrice.name}`,
          data: freshPrice,
          fields: this.getPriceFields(freshPrice),
          refreshData: () => this.fetchPriceData(price.id)
        };

        this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });
      },
      error: (error) => {
        console.error('Error loading price details:', error);
        alert('Failed to load price details. Please try again.');
      }
    });
  }

  private editPrice(price: Price): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.prices.showPrice(token, price.id).subscribe({
      next: (freshPrice: any) => {
        const dialogData: AdminDialogData = {
          mode: 'edit',
          resourceType: 'prices',
          title: `Edit Price - ${freshPrice.name}`,
          data: freshPrice,
          fields: this.getPriceFields(freshPrice),
          refreshData: () => this.fetchPriceData(price.id)
        };

        const dialogRef = this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });

        dialogRef.afterClosed().subscribe((result: DialogResult) => {
          if (result && result.action === 'save') {
            this.updatePrice(freshPrice.id, result.data);
          }
        });
      },
      error: (error) => {
        console.error('Error loading price details:', error);
        alert('Failed to load price details. Please try again.');
      }
    });
  }

  private createPrice(data: any): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.prices.createPrice(token, data).subscribe({
      next: (response) => {
        console.log('Price created successfully:', response);
        this.loadPrices();
      },
      error: (error) => {
        console.error('Error creating price:', error);
        alert('Failed to create price. Please try again.');
      }
    });
  }

  private updatePrice(priceId: number, data: any): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.prices.updatePrice(token, priceId, data).subscribe({
      next: (response) => {
        console.log('Price updated successfully:', response);
        this.loadPrices();
      },
      error: (error) => {
        console.error('Error updating price:', error);
        alert('Failed to update price. Please try again.');
      }
    });
  }

  private deletePrice(price: Price): void {
    if (confirm(`Are you sure you want to delete price "${price.name}"?`)) {
      const token = this.loginService.getToken();
      this.internalApi.admin.prices.deletePrice(token, price.id).subscribe({
        next: (response) => {
          console.log('Price deleted successfully:', response);
          this.loadPrices();
        },
        error: (error) => {
          console.error('Error deleting price:', error);
          alert('Failed to delete price. Please try again.');
        }
      });
    }
  }

  private fetchPriceData(priceId: number): Promise<any> {
    const token = this.loginService.getToken();

    return new Promise((resolve, reject) => {
      this.internalApi.admin.prices.showPrice(token, priceId).subscribe({
        next: (freshPrice: any) => {
          resolve(freshPrice);
        },
        error: (error) => {
          console.error('Error fetching price data:', error);
          reject(error);
        }
      });
    });
  }
}
