import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { Notification } from '../../interfaces/notification.interface';
import { TranslocoModule } from '@jsverse/transloco';
import { LeafAnimation } from '../cube-view/leaf-animation';

@Component({
  selector: 'app-notifications',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslocoModule
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit, AfterViewInit, OnDestroy {
  notifications = signal<Notification[]>([]);
  isLoading = signal(true);
  currentPage = signal(1);
  hasMoreResults = signal(false);
  totalCount = signal(0);
  isLoadingMore = signal(false);
  hasUnread = computed(() => this.notifications().some(n => !n.read));

  private leafAnimation: LeafAnimation | null = null;

  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    this.loadNotifications(true);
  }

  ngAfterViewInit() {
    this.leafAnimation = new LeafAnimation();
    this.leafAnimation.setActiveFace(0);
    this.leafAnimation.registerFace(0, this.elRef.nativeElement);
    this.leafAnimation.start();
    this.leafAnimation.resume();
  }

  ngOnDestroy() {
    if (this.leafAnimation) {
      this.leafAnimation.destroy();
      this.leafAnimation = null;
    }
  }

  loadNotifications(isInitial = false) {
    if (isInitial) {
      this.isLoading.set(true);
      this.currentPage.set(1);
    } else {
      this.isLoadingMore.set(true);
    }

    const token = this.loginService.getToken();
    const params = { page: this.currentPage(), per_page: 20 };

    this.internalApi.user.notifications.getAll(token, params).subscribe({
      next: (response: any) => {
        const newNotifications = response.notifications || [];
        const pagy = response.pagy || {};

        if (isInitial) {
          this.notifications.set(newNotifications);
        } else {
          this.notifications.set([...this.notifications(), ...newNotifications]);
        }

        this.currentPage.set(pagy.current_page || 1);
        this.hasMoreResults.set(pagy.current_page < pagy.total_pages);
        this.totalCount.set(pagy.total_count || 0);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: () => {
        this.notifications.set([]);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      }
    });
  }

  loadMore() {
    if (this.hasMoreResults() && !this.isLoadingMore()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadNotifications(false);
    }
  }

  markAsRead(notification: Notification) {
    if (notification.read) return;

    const token = this.loginService.getToken();
    this.internalApi.user.notifications.markAsRead(token, notification.id).subscribe({
      next: () => {
        this.notifications.set(this.notifications().map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        ));
      }
    });
  }

  markAllAsRead() {
    const token = this.loginService.getToken();
    this.internalApi.user.notifications.markAllAsRead(token).subscribe({
      next: () => {
        this.notifications.set(this.notifications().map(n => ({ ...n, read: true })));
      }
    });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
