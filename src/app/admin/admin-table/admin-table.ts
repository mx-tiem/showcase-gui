import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';

@Component({
  selector: 'app-admin-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterModule,
    TranslocoModule
  ],
  templateUrl: './admin-table.html',
  styleUrl: './admin-table.scss',
})
export class AdminTable {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() totalItems: number = 0;
  @Input() pageSize: number = 10;
  @Input() pageIndex: number = 0;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  @Input() loading: boolean = false;
  @Input() title: string = '';
  @Input() showCreateButton: boolean = true;
  @Input() actions: string[] = ['view', 'edit', 'delete'];
  
  @Output() sortChange = new EventEmitter<TableSortEvent>();
  @Output() pageChange = new EventEmitter<TablePaginationEvent>();
  @Output() actionClick = new EventEmitter<TableActionEvent>();
  @Output() createClick = new EventEmitter<void>();
  
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
  get displayedColumns(): string[] {
    return this.columns.map(col => col.key);
  }
  
  onSortChange(sort: Sort): void {
    const sortEvent: TableSortEvent = {
      active: sort.active,
      direction: sort.direction
    };
    this.sortChange.emit(sortEvent);
  }
  
  onPageChange(event: PageEvent): void {
    const pageEvent: TablePaginationEvent = {
      pageIndex: event.pageIndex,
      pageSize: event.pageSize,
      length: event.length
    };
    this.pageChange.emit(pageEvent);
  }
  
  getCellValue(row: any, column: TableColumn): string {
    const value = row[column.key];
    
    if (column.format) {
      return column.format(value, row);
    }
    
    return value != null ? value.toString() : '';
  }
  
  getColumnClass(column: TableColumn): string {
    return column.cssClass || '';
  }

  getCellClass(row: any, column: TableColumn): string {
    if (column.cellClass) {
      return column.cellClass(row[column.key], row);
    }
    return '';
  }
  
  onViewClick(row: any): void {
    this.actionClick.emit({ action: 'view', row });
  }
  
  onEditClick(row: any): void {
    this.actionClick.emit({ action: 'edit', row });
  }
  
  onDeleteClick(row: any): void {
    this.actionClick.emit({ action: 'delete', row });
  }
  
  onCreateClick(): void {
    this.createClick.emit();
  }
}

