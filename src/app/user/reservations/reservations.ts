import { Component, OnInit, OnChanges, AfterViewInit, SimpleChanges, Input, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Router, ActivatedRoute } from '@angular/router';
import { ReservationsIndex } from './reservations-index/reservations-index';
import { ReservationWizard } from './reservation-wizard/reservation-wizard';
import { TranslocoModule } from '@jsverse/transloco';
import { LoginService } from '../../login/login.service';
import { InternalApiService } from '../../shared/internal-api.service';
import { SquareButton } from '../../shared/buttons/square-button/square-button';

export type ReservationView = 'index' | 'wizard';

@Component({
  selector: 'app-reservations',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule, ReservationsIndex, ReservationWizard, TranslocoModule, SquareButton],
  templateUrl: './reservations.html',
  styleUrl: './reservations.scss',
})
export class Reservations implements OnInit, OnChanges, AfterViewInit {
  @Input() isActive = false;
  @ViewChild('wizard') wizard!: ReservationWizard;

  currentView: ReservationView = 'index';
  playHours: number | null = null;
  // Remove isLoading from parent - child components handle their own loading
  // isLoading = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private loginService: LoginService,
    private internalApi: InternalApiService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    // Check current route to determine initial view
    const currentUrl = this.router.url;
    if (currentUrl.includes('/reservations/new')) {
      this.currentView = 'wizard';
    } else {
      this.currentView = 'index';
    }

    this.loadPlayHours();
  }

  private loadPlayHours() {
    const token = this.loginService.getToken();
    if (token) {
      this.internalApi.user.currentUser(token).subscribe({
        next: (response) => {
          this.playHours = response.available_playhours ?? 0;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading playhours:', error);
          this.playHours = 0;
          this.cdr.detectChanges();
        }
      });
    }
  }

  ngAfterViewInit() {
    this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isActive'] && changes['isActive'].currentValue) {
      this.loadPlayHours();
    }
  }

  // Remove loadReservationsData method - not needed
  // private loadReservationsData() {
  //   // TODO: Implement reservations data loading
  //   console.log('Loading reservations data...');
  // }

  showIndexView() {
    this.currentView = 'index';
  }

  showWizardView() {
    this.currentView = 'wizard';
  }

  switchView() {
    if (this.currentView === 'index') {
      // Skip cube animation when switching to wizard view
      sessionStorage.setItem('skipCubeAnimation', 'true');
      // Navigate to new reservation route instead of just switching view
      this.router.navigate(['/reservations/new']);
    } else {
      // Skip cube animation when switching back to index view
      sessionStorage.setItem('skipCubeAnimation', 'true');
      // Navigate back to reservations route
      this.router.navigate(['/reservations']);
    }
  }

  onReservationCreated(reservation: any) {
    console.log('Reservation created:', reservation);
    // Switch back to index view after successful creation
    sessionStorage.setItem('skipCubeAnimation', 'true');
    this.router.navigate(['/reservations']);
  }

  onNewReservation() {
    this.showWizardView();
  }

  onWizardCancelled() {
    console.log('Reservation wizard cancelled');
    // Skip cube animation when cancelling wizard
    sessionStorage.setItem('skipCubeAnimation', 'true');
    // Navigate back to reservations route
    this.router.navigate(['/reservations']);
  }
}
