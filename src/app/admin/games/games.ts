import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';
import { AdminDialog, AdminDialogData, DialogField, DialogResult } from '../admin-dialog/admin-dialog';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface Game {
  id: number;
  name: string;
  game_identifier: string;
  description: string;
  genre: string;
  multiplayer: boolean;
  coop: boolean;
  controller_support: boolean;
  platform: string;
  logo_url: string | null;
}

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [AdminTable, MatButtonModule],
  templateUrl: './games.html',
  styleUrl: './games.scss',
})
export class Games implements OnInit {
  games: Game[] = [];
  totalGames = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;

  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.games.columns.id'), sortable: true, cssClass: 'id-column' },
    { key: 'name', label: marker('admin.games.columns.name'), sortable: true },
    { key: 'game_identifier', label: marker('admin.games.columns.identifier'), sortable: true },
    { key: 'genre', label: marker('admin.games.columns.genre'), sortable: true },
    { key: 'platform', label: marker('admin.games.columns.platform'), sortable: true },
    { key: 'multiplayer', label: marker('admin.games.columns.multiplayer'), sortable: true },
    { key: 'coop', label: marker('admin.games.columns.coop'), sortable: true },
    { key: 'controller_support', label: marker('admin.games.columns.controller'), sortable: true },
    { key: 'actions', label: marker('admin.games.columns.actions'), sortable: false, isActions: true, cssClass: 'actions-column' }
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}

  ngOnInit(): void {
    this.loadGames();
  }

  loadGames(): void {
    this.loading = true;
    const token = this.loginService.getToken();

    const params = {
      page: this.pageIndex + 1,
      per_page: this.pageSize
    };

    this.internalApi.admin.games.getGames(token, params).subscribe({
      next: (response: any) => {
        this.games = response.games;
        this.totalGames = response.pagy.total_count;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading games:', error);
        this.games = [];
        this.totalGames = 0;
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
    this.loadGames();
  }

  onActionClick(event: TableActionEvent): void {
    const game = event.row as Game;

    switch (event.action) {
      case 'view':
        this.viewGame(game);
        break;
      case 'edit':
        this.editGame(game);
        break;
      case 'delete':
        this.deleteGame(game);
        break;
    }
  }

  onCreateGame(): void {
    const emptyGame: Partial<Game> = {
      name: '',
      game_identifier: '',
      description: '',
      genre: 'FPS',
      multiplayer: true,
      coop: false,
      controller_support: false,
      platform: 'PC'
    };

    const dialogData: AdminDialogData = {
      mode: 'create',
      resourceType: 'games',
      title: 'Create New Game',
      fields: this.getGameFields(emptyGame as Game)
    };

    const dialogRef = this.dialog.open(AdminDialog, {
      width: '70vw',
      height: '80vh',
      maxWidth: '1200px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: DialogResult) => {
      if (result && result.action === 'save') {
        this.createGame(result.data);
      }
    });
  }

  private getGameFields(game: Game): DialogField[] {
    return [
      { key: 'name', label: 'Game Name', type: 'text', value: game.name, required: true },
      { key: 'game_identifier', label: 'Game Identifier', type: 'text', value: game.game_identifier },
      { key: 'description', label: 'Description', type: 'textarea', value: game.description },
      {
        key: 'genre',
        label: 'Genre',
        type: 'select',
        value: game.genre,
        required: true,
        options: [
          { value: 'FPS', label: 'FPS' },
          { value: 'RPG', label: 'RPG' },
          { value: 'MOBA', label: 'MOBA' },
          { value: 'Strategy', label: 'Strategy' },
          { value: 'Sports', label: 'Sports' },
          { value: 'Racing', label: 'Racing' },
          { value: 'Fighting', label: 'Fighting' },
          { value: 'Simulation', label: 'Simulation' },
          { value: 'Adventure', label: 'Adventure' },
          { value: 'Puzzle', label: 'Puzzle' },
          { value: 'Horror', label: 'Horror' },
          { value: 'Other', label: 'Other' }
        ]
      },
      {
        key: 'platform',
        label: 'Platform',
        type: 'select',
        value: game.platform,
        required: true,
        options: [
          { value: 'PC', label: 'PC' },
          { value: 'PlayStation', label: 'PlayStation' },
          { value: 'Xbox', label: 'Xbox' },
          { value: 'Cross-platform', label: 'Cross-platform' }
        ]
      },
      { key: 'multiplayer', label: 'Multiplayer', type: 'select', value: game.multiplayer,
        options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' }
        ]
      },
      { key: 'coop', label: 'Co-op', type: 'select', value: game.coop,
        options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' }
        ]
      },
      { key: 'controller_support', label: 'Controller Support', type: 'select', value: game.controller_support,
        options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' }
        ]
      },
      { key: 'logo', label: 'Game Logo', type: 'file', value: game.logo_url, accept: 'image/*' }
    ];
  }

  private viewGame(game: Game): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.games.showGame(token, game.id).subscribe({
      next: (response: any) => {
        const freshGame = response.game || response;

        const dialogData: AdminDialogData = {
          mode: 'view',
          resourceType: 'games',
          title: `View Game - ${freshGame.name}`,
          data: freshGame,
          fields: this.getGameFields(freshGame),
          refreshData: () => this.fetchGameData(game.id)
        };

        this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });
      },
      error: (error) => {
        console.error('Error loading game details:', error);
        alert('Failed to load game details. Please try again.');
      }
    });
  }

  private editGame(game: Game): void {
    const token = this.loginService.getToken();

    this.internalApi.admin.games.showGame(token, game.id).subscribe({
      next: (response: any) => {
        const freshGame = response.game || response;

        const dialogData: AdminDialogData = {
          mode: 'edit',
          resourceType: 'games',
          title: `Edit Game - ${freshGame.name}`,
          data: freshGame,
          fields: this.getGameFields(freshGame),
          refreshData: () => this.fetchGameData(game.id)
        };

        const dialogRef = this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });

        dialogRef.afterClosed().subscribe((result: DialogResult) => {
          if (result && result.action === 'save') {
            this.updateGame(freshGame.id, result.data);
          }
        });
      },
      error: (error) => {
        console.error('Error loading game details:', error);
        alert('Failed to load game details. Please try again.');
      }
    });
  }

  private createGame(data: any): void {
    const token = this.loginService.getToken();
    const formData = this.buildGameFormData(data);

    this.internalApi.admin.games.createGame(token, formData).subscribe({
      next: (response) => {
        console.log('Game created successfully:', response);
        this.loadGames();
      },
      error: (error) => {
        console.error('Error creating game:', error);
        alert('Failed to create game. Please try again.');
      }
    });
  }

  private updateGame(gameId: number, data: any): void {
    const token = this.loginService.getToken();
    const formData = this.buildGameFormData(data);

    this.internalApi.admin.games.updateGame(token, gameId, formData).subscribe({
      next: (response) => {
        console.log('Game updated successfully:', response);
        this.loadGames();
      },
      error: (error) => {
        console.error('Error updating game:', error);
        alert('Failed to update game. Please try again.');
      }
    });
  }

  private buildGameFormData(data: any): FormData {
    const formData = new FormData();
    const fields = ['name', 'game_identifier', 'description', 'genre', 'multiplayer', 'coop', 'controller_support', 'platform'];

    fields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        formData.append(`game[${field}]`, data[field].toString());
      }
    });

    if (data.logo instanceof File) {
      formData.append('game[logo]', data.logo);
    }

    return formData;
  }

  private deleteGame(game: Game): void {
    if (confirm(`Are you sure you want to delete game "${game.name}"?`)) {
      const token = this.loginService.getToken();
      this.internalApi.admin.games.deleteGame(token, game.id).subscribe({
        next: (response) => {
          console.log('Game deleted successfully:', response);
          this.loadGames();
        },
        error: (error) => {
          console.error('Error deleting game:', error);
          alert('Failed to delete game. Please try again.');
        }
      });
    }
  }

  private fetchGameData(gameId: number): Promise<any> {
    const token = this.loginService.getToken();

    return new Promise((resolve, reject) => {
      this.internalApi.admin.games.showGame(token, gameId).subscribe({
        next: (response: any) => {
          const freshGame = response.game || response;
          resolve(freshGame);
        },
        error: (error) => {
          console.error('Error fetching game data:', error);
          reject(error);
        }
      });
    });
  }
}
