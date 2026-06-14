import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { AdminDialog, AdminDialogData, DialogResult, DialogField } from '../admin-dialog/admin-dialog';
import { UserView } from './user-view/user-view';
import { TranslocoService } from '@jsverse/transloco';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  total_playhours?: number;
  discount_play?: number;
  discount_admin?: number;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [AdminTable, MatButtonModule],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  users: User[] = [];
  totalUsers = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  
  constructor(
    private cdr: ChangeDetectorRef,
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private dialog: MatDialog
  ) {}
  
  currentSort: TableSortEvent = { active: '', direction: '' };
  
  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.users.columns.id'), sortable: true, cssClass: 'id-column' },
    { key: 'name', label: marker('admin.users.columns.name'), sortable: true },
    { key: 'email', label: marker('admin.users.columns.email'), sortable: true },
    { key: 'total_playhours', label: marker('admin.users.columns.playHours'), sortable: true },
    { key: 'role', label: marker('admin.users.columns.role'), sortable: true },
    { key: 'actions', label: marker('admin.users.columns.actions'), sortable: false, isActions: true, cssClass: 'actions-column' }
  ];
  
  ngOnInit(): void {
    this.loadUsers();
  }
  
  loadUsers(): void {
    this.loading = true;
    const token = this.loginService.getToken();
    
    const params: any = {
      page: this.pageIndex + 1, // Backend usually expects 1-based page index
      per_page: this.pageSize
    };
    
    if (this.currentSort.active && this.currentSort.direction) {
      params.sort_by = this.currentSort.active;
      params.sort_direction = this.currentSort.direction;
    }
    
    this.internalApi.admin.users.getUsers(token, params).subscribe({
      next: (response: any) => {
        this.users = response.users;
        this.totalUsers = response.pagy.total_count;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
        this.users = [];
        this.totalUsers = 0;
        this.cdr.detectChanges();
      }
    });
  }
  
  onSortChange(event: TableSortEvent): void {
    this.currentSort = event;
    this.pageIndex = 0; // Reset to first page on sort change
    this.loadUsers();
  }
  
  onPageChange(event: TablePaginationEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }
  
  onActionClick(event: TableActionEvent): void {
    const user = event.row as User;
    
    switch (event.action) {
      case 'view':
        this.openViewDialog(user);
        break;
      case 'edit':
        this.openEditDialog(user);
        break;
      case 'delete':
        this.confirmDelete(user);
        break;
    }
  }
  
  onCreateUser(): void {
    const emptyUser: Partial<User> = {
      name: '',
      email: '',
      role: 'user',
      status: 'active'
    };
    
    const dialogData: AdminDialogData = {
      mode: 'create',
      resourceType: 'users',
      title: 'Create New User',
      fields: this.getUserFields(emptyUser as User, false)
    };
    
    const dialogRef = this.dialog.open(AdminDialog, {
      width: '70vw',
      height: '80vh',
      maxWidth: '1200px',
      data: dialogData
    });
    
    dialogRef.afterClosed().subscribe((result: DialogResult) => {
      if (result && result.action === 'save') {
        this.createUser(result.data);
      }
    });
  }
  
  private createUser(data: any): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.users.createUser(token, data).subscribe({
      next: (response) => {
        console.log('User created successfully:', response);
        this.loadUsers();
      },
      error: (error) => {
        console.error('Error creating user:', error);
        alert('Failed to create user. Please try again.');
      }
    });
  }
  
  private getUserFields(user: User, readonly: boolean = false): DialogField[] {
    const fields: DialogField[] = [
      { key: 'name', label: 'Name', type: 'text' as const, value: user.name, required: true, readonly },
      { key: 'email', label: 'Email', type: 'email' as const, value: user.email, required: true, readonly },
    ];
    
    // Add password field only for edit/create modes (not view mode)
    if (!readonly) {
      fields.push({
        key: 'password',
        label: user.id ? 'Password (leave blank to keep current)' : 'Password',
        type: 'password' as const,
        value: '',
        required: !user.id, // Required only for new users
        readonly: false,
        placeholder: user.id ? 'Enter new password or leave blank' : 'Enter password'
      });
    }
    
    fields.push(
      { 
        key: 'role', 
        label: 'Role', 
        type: 'select' as const, 
        value: user.role, 
        required: true,
        readonly,
        options: [
          { value: 'admin', label: 'Admin' },
          { value: 'user', label: 'User' },
          { value: 'moderator', label: 'Moderator' }
        ]
      }
    );

    if (!readonly) {
      fields.push({
        key: 'discount_admin',
        label: 'Admin Discount (%)',
        type: 'number' as const,
        value: (user as any).discount_admin || 0,
        required: false,
        readonly: false,
        placeholder: 'e.g. 10 for 10%'
      });
    }
    
    return fields;
  }
  
  private openViewDialog(user: User): void {
    const token = this.loginService.getToken();
    
    // Fetch fresh user data before opening the dialog
    this.internalApi.admin.users.showUser(token, user.id).subscribe({
      next: (response: any) => {
        const freshUser = response.user || response;
        
        const dialogData: AdminDialogData = {
          mode: 'view',
          resourceType: 'users',
          title: `View User - ${freshUser.name}`,
          data: freshUser,
          customViewComponent: UserView,
          customViewInputs: {
            userData: freshUser
          },
          refreshData: () => this.fetchUserData(user.id)
        };
        
        const dialogRef = this.dialog.open(AdminDialog, {
          width: '80vw',
          height: '90vh',
          maxWidth: '80vw',
          data: dialogData
        });
        
        // Handle edit action from the custom view
        dialogRef.afterClosed().subscribe((result: any) => {
          if (result && result.action === 'edit') {
            this.openEditDialog(result.user);
          } else if (result && result.action === 'save') {
            this.updateUser(freshUser.id, result.data);
          }
        });
      },
      error: (error) => {
        console.error('Error loading user details:', error);
        alert('Failed to load user details. Please try again.');
      }
    });
  }
  
  private openEditDialog(user: User): void {
    const token = this.loginService.getToken();
    
    // Fetch fresh user data before opening the dialog
    this.internalApi.admin.users.showUser(token, user.id).subscribe({
      next: (response: any) => {
        const freshUser = response.user || response;
        
        const dialogData: AdminDialogData = {
          mode: 'edit',
          resourceType: 'users',
          title: `Edit User - ${freshUser.name}`,
          data: freshUser,
          fields: this.getUserFields(freshUser, false),
          refreshData: () => this.fetchUserData(user.id)
        };
        
        const dialogRef = this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });
        
        dialogRef.afterClosed().subscribe((result: DialogResult) => {
          if (result && result.action === 'save') {
            this.updateUser(freshUser.id, result.data);
          }
        });
      },
      error: (error) => {
        console.error('Error loading user details:', error);
        alert('Failed to load user details. Please try again.');
      }
    });
  }
  
  private confirmDelete(user: User): void {
    if (confirm(`Are you sure you want to delete user "${user.name}"?`)) {
      this.deleteUser(user.id);
    }
  }
  
  private updateUser(userId: number, data: any): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.users.updateUser(token, userId, data).subscribe({
      next: (response) => {
        console.log('User updated successfully:', response);
        this.loadUsers();
      },
      error: (error) => {
        console.error('Error updating user:', error);
        alert('Failed to update user. Please try again.');
      }
    });
  }
  
  private deleteUser(userId: number): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.users.deleteUser(token, userId).subscribe({
      next: (response) => {
        console.log('User deleted successfully:', response);
        this.loadUsers();
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    });
  }
  
  private fetchUserData(userId: number): Promise<any> {
    const token = this.loginService.getToken();
    
    return new Promise((resolve, reject) => {
      this.internalApi.admin.users.showUser(token, userId).subscribe({
        next: (response: any) => {
          const freshUser = response.user || response;
          resolve(freshUser);
        },
        error: (error) => {
          console.error('Error fetching user data:', error);
          reject(error);
        }
      });
    });
  }
}

