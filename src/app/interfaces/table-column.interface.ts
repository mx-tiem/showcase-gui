export interface TableColumn {
  /** The key to access data from the data source */
  key: string;
  
  /** The display label for the column header */
  label: string;
  
  /** Whether the column is sortable (default: true) */
  sortable?: boolean;
  
  /** Custom template function to format the cell value */
  format?: (value: any, row: any) => string;

  /** Optional callback to return a CSS class for the cell content (renders as a badge/span) */
  cellClass?: (value: any, row: any) => string;

  /** CSS class to apply to the column */
  cssClass?: string;
  
  /** Whether this is an actions column */
  isActions?: boolean;
}

export interface TablePaginationEvent {
  pageIndex: number;
  pageSize: number;
  length: number;
}

export interface TableSortEvent {
  active: string;
  direction: 'asc' | 'desc' | '';
}

export interface TableActionEvent {
  action: 'view' | 'edit' | 'delete';
  row: any;
}
