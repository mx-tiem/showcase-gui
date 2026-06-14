import { Component, Input, OnInit, OnDestroy, AfterViewInit, ViewChild, ViewContainerRef, ComponentRef, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogRef } from '@angular/material/dialog';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';

interface UserDetails {
  id: number;
  name: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Component({
  selector: 'app-user-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatTabsModule,
    TranslocoModule
  ],
  templateUrl: './user-view.html',
  styleUrl: './user-view.scss',
})
export class UserView implements OnInit, AfterViewInit, OnDestroy {
  @Input() userId?: number;
  @Input() userData?: UserDetails;
  @Input() dialogRef?: MatDialogRef<any>;
  @ViewChild('reservationsContainer', { read: ViewContainerRef }) reservationsContainer!: ViewContainerRef;
  @ViewChild('hoursContainer', { read: ViewContainerRef }) hoursContainer!: ViewContainerRef;
  @ViewChild('gamesContainer', { read: ViewContainerRef }) gamesContainer!: ViewContainerRef;
  @ViewChild('notificationsContainer', { read: ViewContainerRef }) notificationsContainer!: ViewContainerRef;
  
  user: UserDetails | null = null;
  loading = false;
  error: string | null = null;
  
  private reservationsComponentRef?: ComponentRef<any>;
  private hoursComponentRef?: ComponentRef<any>;
  private gamesComponentRef?: ComponentRef<any>;
  private notificationsComponentRef?: ComponentRef<any>;
  
  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}
  
  ngOnInit(): void {
    // If userData is provided directly, use it
    if (this.userData) {
      this.user = this.userData;
      return;
    }
    
    // Otherwise load from API
    if (this.userId) {
      this.loadUser();
    } else {
      this.error = 'No user ID or data provided';
    }
  }
  
  loadUser(): void {
    if (!this.userId) return;
    
    this.loading = true;
    this.error = null;
    const token = this.loginService.getToken();
    
    this.internalApi.admin.users.showUser(token, this.userId).subscribe({
      next: (response: any) => {
        this.user = response.user || response;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.error = 'Failed to load user details';
        this.loading = false;
      }
    });
  }
  
  ngAfterViewInit(): void {
    // Load the first tab (Reservations) when the view is initialized
    // Use longer delay to ensure change detection has completed
    setTimeout(() => this.onTabChange(0), 100);
  }
  
  goBack(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
  
  editUser(): void {
    // This will be handled by the parent component through the dialog
    if (this.dialogRef) {
      this.dialogRef.close({ action: 'edit', user: this.user });
    }
  }
  
  getRoleClass(role: string): string {
    return `role-${role?.toLowerCase()}`;
  }
  
  getStatusClass(status?: string): string {
    return `status-${status?.toLowerCase() || 'unknown'}`;
  }
  
  formatDate(date?: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', { timeZone: 'Europe/Zagreb' });
  }
  
  async onTabChange(index: number): Promise<void> {
    switch (index) {
      case 0:
        await this.loadReservationsComponent();
        break;
      case 1:
        await this.loadHoursComponent();
        break;
      case 2:
        await this.loadGamesComponent();
        break;
      case 3:
        await this.loadNotificationsComponent();
        break;
    }
  }
  
  private async loadReservationsComponent(): Promise<void> {
    if (!this.reservationsContainer) return;
    
    if (!this.reservationsComponentRef) {
      const { UserReservations } = await import('../user-reservations/user-reservations');
      this.reservationsContainer.clear();
      this.reservationsComponentRef = this.reservationsContainer.createComponent(UserReservations);
      this.reservationsComponentRef.setInput('userId', this.user?.id || this.userId);
    }
    
    // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    if (this.reservationsComponentRef?.instance?.loadReservations) {
      setTimeout(() => this.reservationsComponentRef!.instance.loadReservations(), 100);
    }
  }
  
  private async loadHoursComponent(): Promise<void> {
    if (!this.hoursContainer) return;
    
    if (!this.hoursComponentRef) {
      const { UserHours } = await import('../user-hours/user-hours');
      this.hoursContainer.clear();
      this.hoursComponentRef = this.hoursContainer.createComponent(UserHours);
      this.hoursComponentRef.setInput('userId', this.user?.id || this.userId);
      this.hoursComponentRef.setInput('userData', this.user);
    }
    
    // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    if (this.hoursComponentRef?.instance?.loadHours) {
      setTimeout(() => this.hoursComponentRef!.instance.loadHours(), 100);
    }
  }
  
  private async loadGamesComponent(): Promise<void> {
    if (!this.gamesContainer) return;
    
    if (!this.gamesComponentRef) {
      const { UserGames } = await import('../user-games/user-games');
      this.gamesContainer.clear();
      this.gamesComponentRef = this.gamesContainer.createComponent(UserGames);
      this.gamesComponentRef.setInput('userId', this.user?.id || this.userId);
    }
    
    // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    if (this.gamesComponentRef?.instance?.loadGames) {
      setTimeout(() => this.gamesComponentRef!.instance.loadGames(), 100);
    }
  }
  
  private async loadNotificationsComponent(): Promise<void> {
    if (!this.notificationsContainer) return;
    
    if (!this.notificationsComponentRef) {
      const { UserNotifications } = await import('../user-notifications/user-notifications');
      this.notificationsContainer.clear();
      this.notificationsComponentRef = this.notificationsContainer.createComponent(UserNotifications);
      this.notificationsComponentRef.setInput('userId', this.user?.id || this.userId);
    }
    
    // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    if (this.notificationsComponentRef?.instance?.loadNotifications) {
      setTimeout(() => this.notificationsComponentRef!.instance.loadNotifications(), 100);
    }
  }
  
  ngOnDestroy(): void {
    if (this.reservationsComponentRef) {
      this.reservationsComponentRef.destroy();
    }
    if (this.hoursComponentRef) {
      this.hoursComponentRef.destroy();
    }
    if (this.gamesComponentRef) {
      this.gamesComponentRef.destroy();
    }
    if (this.notificationsComponentRef) {
      this.notificationsComponentRef.destroy();
    }
  }
}
