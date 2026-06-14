import { Component, Input, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogRef } from '@angular/material/dialog';
import { InternalApiService } from '../../../shared/internal-api.service';
import { LoginService } from '../../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';

interface MachineDetails {
  id: number;
  name: string;
  machine_type: string;
  status: string;
  hardware_configuration?: string;
  start_work_hours?: string;
  end_work_hours?: string;
  working_days?: string[];
  warden_callback_secret?: string;
  warden_callback_port?: number;
  warden_global_ip?: string;
  warden_local_ip?: string;
}

@Component({
  selector: 'app-machine-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    TranslocoModule,
  ],
  templateUrl: './machine-view.html',
  styleUrl: './machine-view.scss',
})
export class MachineView implements OnInit {
  @Input() machineData?: MachineDetails;
  @Input() dialogRef?: MatDialogRef<any>;

  commandLoading: Record<string, boolean> = {};
  commandMessage = '';
  commandMessageType: 'success' | 'error' = 'success';

  wardenStatus: any = null;
  wardenStatusLoading = false;
  wardenStatusError = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private internalApi: InternalApiService,
    private loginService: LoginService,
  ) {}

  ngOnInit(): void {
    if (this.isWardenConnected && this.machine) {
      this.fetchWardenStatus();
    }
  }

  get machine(): MachineDetails | null {
    return this.machineData || null;
  }

  get isWardenConnected(): boolean {
    return !!(this.machine?.warden_local_ip && this.machine?.warden_callback_port);
  }

  sendCommand(command: string): void {
    if (!this.machine) return;

    this.commandLoading[command] = true;
    this.commandMessage = '';
    this.cdr.detectChanges();

    const token = this.loginService.getToken();

    this.internalApi.admin.machines.wardenCommand(token, this.machine.id, command).subscribe({
      next: (response: any) => {
        this.commandLoading[command] = false;
        this.commandMessage = response.message || `Command '${command}' sent successfully.`;
        this.commandMessageType = 'success';
        this.cdr.detectChanges();
        this.clearMessageAfterDelay();
      },
      error: (error: any) => {
        this.commandLoading[command] = false;
        this.commandMessage = error?.error?.error || `Failed to send '${command}' command.`;
        this.commandMessageType = 'error';
        this.cdr.detectChanges();
        this.clearMessageAfterDelay();
      },
    });
  }

  fetchWardenStatus(): void {
    if (!this.machine) return;

    this.wardenStatusLoading = true;
    this.wardenStatusError = '';
    this.cdr.detectChanges();

    const token = this.loginService.getToken();

    this.internalApi.admin.machines.wardenStatus(token, this.machine.id).subscribe({
      next: (response: any) => {
        this.wardenStatus = response;
        this.wardenStatusLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.wardenStatusLoading = false;
        this.wardenStatusError = error?.error?.error || 'Failed to fetch warden status.';
        this.cdr.detectChanges();
      },
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'available': return 'status-available';
      case 'working': return 'status-working';
      case 'maintenance': return 'status-maintenance';
      default: return '';
    }
  }

  getMachineTypeLabel(type: string): string {
    switch (type) {
      case 'gaming_pc': return 'Gaming PC';
      case 'streaming_pc': return 'Streaming PC';
      case 'playstation': return 'PlayStation';
      case 'xbox': return 'Xbox';
      default: return type;
    }
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '–';
    const date = new Date(dateStr);
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Zagreb' });
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.commandMessage = '';
      this.cdr.detectChanges();
    }, 5000);
  }
}
