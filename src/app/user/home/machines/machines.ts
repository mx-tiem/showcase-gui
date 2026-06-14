import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';

export interface MachineStatus {
  id: number;
  name: string;
  machineType: string;
  status: 'available' | 'working' | 'maintenance';
  currentGame: string | null;
  gameLogoUrl: string | null;
  currentUser: string | null;
  isFriend: boolean;
}

@Component({
  selector: 'app-machines',
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './machines.html',
  styleUrl: './machines.scss',
})
export class Machines implements OnInit {
  @Input() set isActive(value: boolean) {
    if (value && !this.dataLoaded) {
      this.loadMachines();
    }
  }

  machines: MachineStatus[] = [];
  private dataLoaded = false;

  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadMachines();
  }

  private loadMachines() {
    const token = this.loginService.getToken();
    if (!token) return;

    this.internalApi.user.machines.getMachines(token).subscribe({
      next: (response: any) => {
        if (response.machines) {
          this.machines = response.machines.map((m: any) => ({
            id: m.id,
            name: m.name,
            machineType: m.machine_type,
            status: m.status,
            currentGame: m.current_game,
            gameLogoUrl: m.game_logo_url,
            currentUser: m.current_user,
            isFriend: m.is_friend
          }));
        }
        this.dataLoaded = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading machines:', error);
      }
    });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'working': return 'sports_esports';
      case 'available': return 'check_circle';
      case 'maintenance': return 'build';
      default: return 'help';
    }
  }

  getMachineTypeIcon(machineType: string): string {
    switch (machineType) {
      case 'gaming_pc':
      case 'streaming_pc':
        return 'computer';
      case 'playstation':
      case 'xbox':
        return 'videogame_asset';
      default: return 'devices';
    }
  }
}
