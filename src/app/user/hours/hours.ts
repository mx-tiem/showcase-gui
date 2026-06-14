import { Component, OnInit, OnChanges, SimpleChanges, Input, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';

interface PriceItem {
  id: number;
  name: string;
  description: string;
  price: number;
  discounted_price: number | null;
  amount: number;
  hours_type: string;
  currency: string;
}

interface GameSummary {
  game_id: number;
  game_name: string;
  logo_url: string | null;
  total_minutes: number;
  session_count: number;
}

@Component({
  selector: 'app-hours',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    TranslocoModule
  ],
  templateUrl: './hours.html',
  styleUrl: './hours.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Hours implements OnInit, OnChanges {
  @Input() isActive = false;

  prices: PriceItem[] = [];
  gameSummary: GameSummary[] = [];
  totalReservations = 0;
  discount = 0;
  discountPlay = 0;
  discountAdmin = 0;
  isLoading = false;
  loadError = '';

  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (this.isActive) {
      this.loadHoursData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isActive'] && changes['isActive'].currentValue && !changes['isActive'].previousValue) {
      this.loadHoursData();
    }
  }

  private loadHoursData() {
    this.isLoading = true;
    this.loadError = '';
    const token = this.loginService.getToken();

    this.internalApi.user.prices.getPrices(token).subscribe({
      next: (response: any) => {
        this.prices = response.prices || [];
        this.discount = response.discount || 0;
        this.discountPlay = response.discount_play || 0;
        this.discountAdmin = response.discount_admin || 0;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to load prices:', error);
        this.loadError = 'Failed to load prices. Please try again.';
        this.prices = [];
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });

    this.internalApi.user.gamePlays.getSummary(token).subscribe({
      next: (response: any) => {
        this.gameSummary = response.summary || [];
        this.totalReservations = response.total_reservations || 0;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to load game summary:', error);
        this.gameSummary = [];
        this.cdr.markForCheck();
      }
    });
  }

  get hasDiscount(): boolean {
    return this.discount > 0;
  }

  avgPrice(price: PriceItem): number {
    return +(price.price / price.amount).toFixed(2);
  }

  avgDiscountedPrice(price: PriceItem): number | null {
    if (!price.discounted_price) return null;
    return +(price.discounted_price / price.amount).toFixed(2);
  }

  formatTotalTime(minutes: number): string {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }
}
