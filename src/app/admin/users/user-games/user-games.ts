import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';

interface GamePlay {
  id: number;
  game_name: string;
  game_genre: string;
  machine_name: string | null;
  play_started_at: string;
  play_ended_at: string | null;
  duration_minutes: number | null;
}

interface GameSummary {
  game_id: number;
  game_name: string;
  logo_url: string | null;
  total_minutes: number;
  session_count: number;
}

@Component({
  selector: 'app-user-games',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatCardModule,
    TranslocoModule
  ],
  templateUrl: './user-games.html',
  styleUrl: './user-games.scss',
})
export class UserGames implements OnInit {
  @Input() userId!: number;
  
  games: GamePlay[] = [];
  summary: GameSummary[] = [];
  totalGames = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  error: string | null = null;
  displayedColumns: string[] = ['game_name', 'game_genre', 'machine_name', 'play_started_at', 'play_ended_at', 'duration'];
  
  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    // Component will be loaded dynamically, data loaded via loadGames()
  }
  
  loadGames(): void {
    this.loading = true;
    this.error = null;
    const token = this.loginService.getToken();

    const params = {
      page: this.pageIndex + 1,
      per_page: this.pageSize
    };

    this.internalApi.admin.users.getUserGamePlays(token, this.userId, params).subscribe({
      next: (response: any) => {
        this.games = response.game_plays || [];
        this.summary = response.summary || [];
        this.totalGames = response.pagy?.total_count || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading game plays:', error);
        this.error = 'Failed to load game plays';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadGames();
  }
  
  formatDate(date?: string | Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${displayHours}:${minutes} ${ampm}`;
  }
  
  formatDuration(minutes?: number | null): string {
    if (minutes === null || minutes === undefined) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  isActive(game: GamePlay): boolean {
    return !game.play_ended_at;
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
