import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { LoginService } from '../../login/login.service';
import { InternalApiService } from '../../shared/internal-api.service';
import { Notification } from '../../interfaces/notification.interface';
import { filter, Subscription } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TranslocoModule } from '@jsverse/transloco';
import { marker } from '@jsverse/transloco-keys-manager/marker';

@Component({
  selector: 'app-toolbar',
  imports: [CommonModule, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatBadgeModule, MatDividerModule, RouterModule, TranslocoModule],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class Toolbar implements OnInit, OnDestroy {
  isLoggedIn = signal(false);
  isMobile = signal(false);
  userRole = signal<string>('');
  userName = signal<string>('');
  private userSub?: Subscription;
  private breakpointSub?: Subscription;
  private routerSub?: Subscription;

  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);

  loggedInNavItems = [
    { label: marker('nav.admin'), route: '/admin/dashboard', requiredRole: 'admin' },
    { label: marker('nav.home'), route: '/home' },
    { label: marker('nav.reservations'), route: '/reservations' },
    { label: marker('nav.friends'), route: '/friends' },
  ];

  loggedOutNavItems = [
    { label: marker('nav.about'), route: '/about' },
    { label: marker('nav.contact'), route: '/contact' },
  ];

  get navItems() {
    const items = this.isLoggedIn() ? this.loggedInNavItems : this.loggedOutNavItems;
    return items.filter(item => {
      if ((item as any).requiredRole) {
        return this.userRole() === (item as any).requiredRole;
      }
      return true;
    });
  }

  constructor(
    private loginService: LoginService,
    private internalApi: InternalApiService,
    private breakpointObserver: BreakpointObserver,
    private router: Router
  ) {}

  ngOnInit() {
    this.userSub = this.loginService.user.subscribe(user => {
      this.isLoggedIn.set(!!user);
      this.userRole.set(user?.role || '');
      this.userName.set(user?.name || '');
      if (user) {
        this.loadDropdownNotifications();
      } else {
        this.notifications.set([]);
        this.unreadCount.set(0);
      }
    });
    
    this.breakpointSub = this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.Tablet])
      .subscribe(result => {
        this.isMobile.set(result.matches);
      });

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isLoggedIn()) {
          this.loadDropdownNotifications();
        }
      });
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.breakpointSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  onSettings() {
    this.router.navigate(['/settings']);
  }

  onViewAllNotifications() {
    this.router.navigate(['/notifications']);
  }

  onNotificationMenuOpened() {
    if (this.unreadCount() > 0) {
      const token = this.loginService.getToken();
      this.internalApi.user.notifications.markAllAsRead(token).subscribe({
        next: () => {
          this.notifications.set(this.notifications().map(n => ({ ...n, read: true })));
          this.unreadCount.set(0);
        }
      });
    }
  }

  private loadDropdownNotifications() {
    const token = this.loginService.getToken();
    this.internalApi.user.notifications.getDropdown(token).subscribe({
      next: (response: any) => {
        this.notifications.set(response.notifications || []);
        this.unreadCount.set(response.unread_count || 0);
      },
      error: () => {
        this.notifications.set([]);
        this.unreadCount.set(0);
      }
    });
  }

  onLogout() {
    this.loginService.logout();
  }
}
