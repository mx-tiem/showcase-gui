import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AdminTable } from '../admin-table/admin-table';
import { TableColumn, TablePaginationEvent, TableSortEvent, TableActionEvent } from '../../interfaces/table-column.interface';
import { AdminDialog, AdminDialogData, DialogField, DialogResult } from '../admin-dialog/admin-dialog';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { MachineView } from './machine-view/machine-view';
import { TranslocoService } from '@jsverse/transloco';
import { marker } from '@jsverse/transloco-keys-manager/marker';

interface Machine {
  id: number;
  name: string;
  machine_type: string;
  status: string;
  hardware_configuration?: string;
  start_work_hours?: string;
  end_work_hours?: string;
  working_days?: string[];
  reservation_priority?: number;
  warden_global_ip?: string;
  warden_local_ip?: string;
  warden_callback_port?: number;
  warden_callback_secret?: string;
}

@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [AdminTable, MatButtonModule],
  templateUrl: './machines.html',
  styleUrl: './machines.scss',
})
export class Machines implements OnInit {
  machines: Machine[] = [];
  totalMachines = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;
  
  columns: TableColumn[] = [
    { key: 'id', label: marker('admin.machines.columns.id'), sortable: true, cssClass: 'id-column' },
    { key: 'name', label: marker('admin.machines.columns.name'), sortable: true },
    { key: 'machine_type', label: marker('admin.machines.columns.type'), sortable: true },
    { key: 'status', label: marker('admin.machines.columns.status'), sortable: true },
    { key: 'hardware_configuration', label: marker('admin.machines.columns.hardware'), sortable: false },
    { key: 'actions', label: marker('admin.machines.columns.actions'), sortable: false, isActions: true, cssClass: 'actions-column' }
  ];
  
  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private internalApi: InternalApiService,
    private loginService: LoginService
  ) {}
  
  ngOnInit(): void {
    this.loadMachines();
  }
  
  loadMachines(): void {
    this.loading = true;
    const token = this.loginService.getToken();
    
    const params = {
      page: this.pageIndex + 1,
      per_page: this.pageSize
    };
    
    this.internalApi.admin.machines.getMachines(token, params).subscribe({
      next: (response: any) => {
        this.machines = response.machines;
        this.totalMachines = response.pagy.total_count;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading machines:', error);
        this.machines = [];
        this.totalMachines = 0;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  onSortChange(event: TableSortEvent): void {
    console.log('Sort change:', event);
    // Implement sorting logic
  }
  
  onPageChange(event: TablePaginationEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadMachines();
  }
  
  onActionClick(event: TableActionEvent): void {
    const machine = event.row as Machine;
    
    switch (event.action) {
      case 'view':
        this.viewMachine(machine);
        break;
      case 'edit':
        this.editMachine(machine);
        break;
      case 'delete':
        this.deleteMachine(machine);
        break;
    }
  }
  
  onCreateMachine(): void {
    const emptyMachine: Partial<Machine> = {
      name: '',
      machine_type: '',
      status: 'available',
      hardware_configuration: '',
      start_work_hours: '14:00',
      end_work_hours: '22:00',
      working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      reservation_priority: 0,
      warden_global_ip: '',
      warden_local_ip: '',
      warden_callback_port: undefined,
      warden_callback_secret: ''
    };
    
    const dialogData: AdminDialogData = {
      mode: 'create',
      resourceType: 'machines',
      title: 'Create New Machine',
      fields: this.getMachineFields(emptyMachine as Machine)
    };
    
    const dialogRef = this.dialog.open(AdminDialog, {
      width: '70vw',
      height: '80vh',
      maxWidth: '1200px',
      data: dialogData
    });
    
    dialogRef.afterClosed().subscribe((result: DialogResult) => {
      if (result && result.action === 'save') {
        this.createMachine(result.data);
      }
    });
  }
  
  private getMachineFields(machine: Machine): DialogField[] {
    return [
      { key: 'name', label: 'Machine Name', type: 'text', value: machine.name, required: true },
      { 
        key: 'machine_type', 
        label: 'Type', 
        type: 'select', 
        value: machine.machine_type, 
        required: true,
        options: [
          { value: 'gaming_pc', label: 'Gaming PC' },
          { value: 'streaming_pc', label: 'Streaming PC' },
          { value: 'playstation', label: 'PlayStation' },
          { value: 'xbox', label: 'Xbox' }
        ]
      },
      { 
        key: 'status', 
        label: 'Status', 
        type: 'select', 
        value: machine.status, 
        required: true,
        options: [
          { value: 'available', label: 'Available' },
          { value: 'reserved', label: 'Reserved' },
          { value: 'working', label: 'Working' },
          { value: 'maintenance', label: 'Maintenance' }
        ]
      },
      { key: 'hardware_configuration', label: 'Hardware Configuration', type: 'textarea', value: machine.hardware_configuration },
      { key: 'start_work_hours', label: 'Start Work Hours', type: 'time', value: machine.start_work_hours || '14:00' },
      { key: 'end_work_hours', label: 'End Work Hours', type: 'time', value: machine.end_work_hours || '22:00' },
      {
        key: 'working_days',
        label: 'Working Days',
        type: 'multi-select',
        value: machine.working_days || [],
        options: [
          { value: 'monday', label: 'Monday' },
          { value: 'tuesday', label: 'Tuesday' },
          { value: 'wednesday', label: 'Wednesday' },
          { value: 'thursday', label: 'Thursday' },
          { value: 'friday', label: 'Friday' },
          { value: 'saturday', label: 'Saturday' },
          { value: 'sunday', label: 'Sunday' }
        ]
      },
      { key: 'reservation_priority', label: 'Reservation Priority', type: 'number', value: machine.reservation_priority ?? 0 },
      { key: 'warden_global_ip', label: 'Warden Global IP', type: 'text', value: machine.warden_global_ip },
      { key: 'warden_local_ip', label: 'Warden Local IP', type: 'text', value: machine.warden_local_ip },
      { key: 'warden_callback_port', label: 'Warden Callback Port', type: 'number', value: machine.warden_callback_port },
      { key: 'warden_callback_secret', label: 'Warden Callback Secret', type: 'password', value: machine.warden_callback_secret }
    ];
  }
  
  private viewMachine(machine: Machine): void {
    const token = this.loginService.getToken();
    
    // Fetch fresh machine data before opening the dialog
    this.internalApi.admin.machines.showMachine(token, machine.id).subscribe({
      next: (response: any) => {
        const freshMachine = response.machine || response;
        
        const dialogData: AdminDialogData = {
          mode: 'view',
          resourceType: 'machines',
          title: `View Machine - ${freshMachine.name}`,
          data: freshMachine,
          fields: this.getMachineFields(freshMachine),
          customViewComponent: MachineView,
          customViewInputs: {
            machineData: freshMachine
          },
          refreshData: () => this.fetchMachineData(machine.id)
        };
        
        this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });
      },
      error: (error) => {
        console.error('Error loading machine details:', error);
        alert('Failed to load machine details. Please try again.');
      }
    });
  }
  
  private editMachine(machine: Machine): void {
    const token = this.loginService.getToken();
    
    // Fetch fresh machine data before opening the dialog
    this.internalApi.admin.machines.showMachine(token, machine.id).subscribe({
      next: (response: any) => {
        const freshMachine = response.machine || response;
        
        const dialogData: AdminDialogData = {
          mode: 'edit',
          resourceType: 'machines',
          title: `Edit Machine - ${freshMachine.name}`,
          data: freshMachine,
          fields: this.getMachineFields(freshMachine),
          refreshData: () => this.fetchMachineData(machine.id)
        };
        
        const dialogRef = this.dialog.open(AdminDialog, {
          width: '70vw',
          height: '80vh',
          maxWidth: '1200px',
          data: dialogData
        });
        
        dialogRef.afterClosed().subscribe((result: DialogResult) => {
          if (result && result.action === 'save') {
            this.updateMachine(freshMachine.id, result.data);
          }
        });
      },
      error: (error) => {
        console.error('Error loading machine details:', error);
        alert('Failed to load machine details. Please try again.');
      }
    });
  }
  
  private createMachine(data: any): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.machines.createMachine(token, data).subscribe({
      next: (response) => {
        console.log('Machine created successfully:', response);
        this.loadMachines();
      },
      error: (error) => {
        console.error('Error creating machine:', error);
        alert('Failed to create machine. Please try again.');
      }
    });
  }
  
  private updateMachine(machineId: number, data: any): void {
    const token = this.loginService.getToken();
    
    this.internalApi.admin.machines.updateMachine(token, machineId, data).subscribe({
      next: (response) => {
        console.log('Machine updated successfully:', response);
        this.loadMachines();
      },
      error: (error) => {
        console.error('Error updating machine:', error);
        alert('Failed to update machine. Please try again.');
      }
    });
  }
  
  private deleteMachine(machine: Machine): void {
    if (confirm(`Are you sure you want to delete machine "${machine.name}"?`)) {
      const token = this.loginService.getToken();
      this.internalApi.admin.machines.deleteMachine(token, machine.id).subscribe({
        next: (response) => {
          console.log('Machine deleted successfully:', response);
          this.loadMachines();
        },
        error: (error) => {
          console.error('Error deleting machine:', error);
          alert('Failed to delete machine. Please try again.');
        }
      });
    }
  }
  
  private fetchMachineData(machineId: number): Promise<any> {
    const token = this.loginService.getToken();
    
    return new Promise((resolve, reject) => {
      this.internalApi.admin.machines.showMachine(token, machineId).subscribe({
        next: (response: any) => {
          const freshMachine = response.machine || response;
          resolve(freshMachine);
        },
        error: (error) => {
          console.error('Error fetching machine data:', error);
          reject(error);
        }
      });
    });
  }
}
