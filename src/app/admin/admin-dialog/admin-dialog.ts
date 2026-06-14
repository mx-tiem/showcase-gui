import { Component, Inject, Type, ViewChild, ViewContainerRef, ComponentRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { NgxMatTimepickerModule } from 'ngx-mat-timepicker';
import { TranslocoModule } from '@jsverse/transloco';

export type DialogMode = 'view' | 'edit' | 'create';
export type ResourceType = 'users' | 'machines' | 'reservations' | 'games' | 'prices';

export interface DialogField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'datetime-local' | 'time' | 'select' | 'multi-select' | 'textarea' | 'password' | 'file';
  value?: any;
  required?: boolean;
  readonly?: boolean;
  options?: { value: any; label: string }[];
  placeholder?: string;
  accept?: string;
}

export interface AdminDialogData {
  mode: DialogMode;
  resourceType: ResourceType;
  title: string;
  data?: any;
  fields?: DialogField[];
  refreshData?: () => Promise<any>;
  customViewComponent?: Type<any>;
  customViewInputs?: any;
}

export interface DialogResult {
  action: 'save' | 'cancel';
  data?: any;
}

@Component({
  selector: 'app-admin-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    NgxMatTimepickerModule,
    TranslocoModule
  ],
  templateUrl: './admin-dialog.html',
  styleUrl: './admin-dialog.scss',
})
export class AdminDialog implements OnInit, OnDestroy {
  @ViewChild('customViewContainer', { read: ViewContainerRef }) customViewContainer!: ViewContainerRef;
  formData: any = {};
  passwordVisibility: Record<string, boolean> = {};
  private customComponentRef?: ComponentRef<any>;
  
  constructor(
    public dialogRef: MatDialogRef<AdminDialog>,
    @Inject(MAT_DIALOG_DATA) public dialogData: AdminDialogData,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeFormData();
  }
  
  ngOnInit(): void {
    if (this.hasCustomView()) {
      setTimeout(() => this.loadCustomView(), 0);
    }
  }
  
  ngOnDestroy(): void {
    if (this.customComponentRef) {
      this.customComponentRef.destroy();
    }
  }
  
  hasCustomView(): boolean {
    return !!this.dialogData.customViewComponent && this.isViewMode;
  }
  
  private loadCustomView(): void {
    if (!this.dialogData.customViewComponent || !this.customViewContainer) {
      return;
    }
    
    this.customViewContainer.clear();
    this.customComponentRef = this.customViewContainer.createComponent(
      this.dialogData.customViewComponent
    );
    
    // Pass inputs to the custom component
    if (this.dialogData.customViewInputs) {
      Object.keys(this.dialogData.customViewInputs).forEach(key => {
        this.customComponentRef!.setInput(key, this.dialogData.customViewInputs![key]);
      });
    }
    
    // Pass dialogRef if the component needs it
    if (this.customComponentRef.instance.dialogRef !== undefined) {
      this.customComponentRef.instance.dialogRef = this.dialogRef;
    }
  }
  
  private initializeFormData(): void {
    // Initialize form data from fields
    if (!this.dialogData.fields) return;
    
    this.dialogData.fields.forEach(field => {
      if (field.type === 'datetime-local' && field.value) {
        // Split datetime into date and time parts for Material datepicker
        const dateValue = new Date(field.value);
        this.formData[field.key + '_date'] = dateValue;
        this.formData[field.key + '_time'] = this.formatTimeFromDate(dateValue);
        this.formData[field.key] = field.value;
      } else if (field.type === 'time' && field.value) {
        // Normalize time value to HH:MM format
        this.formData[field.key] = this.normalizeTimeValue(field.value);
      } else if (field.type === 'multi-select' && field.options) {
        // Initialize a boolean map for each option
        const selectedValues: any[] = Array.isArray(field.value) ? field.value : [];
        this.formData[field.key] = {};
        field.options.forEach(option => {
          this.formData[field.key][option.value] = selectedValues.includes(option.value);
        });
      } else {
        this.formData[field.key] = field.value ?? '';
      }
    });
  }
  
  private formatTimeFromDate(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private normalizeTimeValue(value: string): string {
    if (!value) return '';
    // Already in HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(value)) return value;
    // Parse as Date to get the correct local time
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return value;
  }
  
  onDateChange(fieldKey: string, dateValue: Date | null): void {
    if (!dateValue) {
      this.formData[fieldKey] = '';
      return;
    }
    
    const timeValue = this.formData[fieldKey + '_time'] || '00:00';
    this.combineDateAndTime(fieldKey, dateValue, timeValue);
  }
  
  onTimeChange(fieldKey: string, timeValue: string): void {
    const dateValue = this.formData[fieldKey + '_date'];
    if (!dateValue) {
      return;
    }
    
    this.combineDateAndTime(fieldKey, dateValue, timeValue);
  }
  
  private combineDateAndTime(fieldKey: string, date: Date, time: string): void {
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    
    // Store as local datetime string (datetime-local compatible)
    const year = combined.getFullYear();
    const month = String(combined.getMonth() + 1).padStart(2, '0');
    const day = String(combined.getDate()).padStart(2, '0');
    const h = String(combined.getHours()).padStart(2, '0');
    const m = String(combined.getMinutes()).padStart(2, '0');
    this.formData[fieldKey] = `${year}-${month}-${day}T${h}:${m}`;
  }
  
  get isViewMode(): boolean {
    return this.dialogData.mode === 'view';
  }
  
  get isEditMode(): boolean {
    return this.dialogData.mode === 'edit';
  }
  
  get isCreateMode(): boolean {
    return this.dialogData.mode === 'create';
  }
  
  get canEdit(): boolean {
    return this.isEditMode || this.isCreateMode;
  }
  
  isFieldReadonly(field: DialogField): boolean {
    return this.isViewMode || field.readonly === true;
  }
  
  toggleMode(): void {
    if (this.isViewMode) {
      // Switch to edit mode
      this.switchToEditMode();
    } else if (this.isEditMode) {
      // Switch to view mode
      this.switchToViewMode();
    }
  }
  
  private async switchToEditMode(): Promise<void> {
    // Fetch fresh data before switching to edit mode
    if (this.dialogData.refreshData) {
      try {
        const freshData = await this.dialogData.refreshData();
        this.updateDialogData(freshData);
      } catch (error) {
        console.error('Error fetching fresh data:', error);
      }
    }
    
    // Use setTimeout to ensure mode change happens outside current change detection
    setTimeout(() => {
      this.dialogData.mode = 'edit';
      this.dialogData.title = this.dialogData.title.replace('View', 'Edit');
      
      // Generate fields if not provided
      if (!this.dialogData.fields && this.dialogData.data) {
        this.dialogData.fields = this.generateFieldsFromData(this.dialogData.data);
      }
      
      if (this.dialogData.fields) {
        this.dialogData.fields = this.dialogData.fields.map(field => ({
          ...field,
          readonly: field.key === 'id' || field.key === 'createdAt' ? true : false
        }));
      }
      
      this.initializeFormData();
      this.cdr.markForCheck();
    }, 0);
  }
  
  private async switchToViewMode(): Promise<void> {
    // Fetch fresh data before switching to view mode
    if (this.dialogData.refreshData) {
      try {
        const freshData = await this.dialogData.refreshData();
        this.updateDialogData(freshData);
      } catch (error) {
        console.error('Error fetching fresh data:', error);
      }
    }
    
    // Use setTimeout to ensure mode change happens outside current change detection
    setTimeout(() => {
      this.dialogData.mode = 'view';
      this.dialogData.title = this.dialogData.title.replace('Edit', 'View');
      if (this.dialogData.fields) {
        this.dialogData.fields = this.dialogData.fields.map(field => ({
          ...field,
          readonly: true
        }));
      }
      this.initializeFormData();
      
      // Update custom view inputs with fresh data
      if (this.dialogData.customViewComponent && this.dialogData.data) {
        this.dialogData.customViewInputs = {
          ...this.dialogData.customViewInputs,
          userData: this.dialogData.data
        };
      }
      
      // Destroy existing component and reload after view updates
      if (this.customComponentRef) {
        this.customComponentRef.destroy();
        this.customComponentRef = undefined;
      }
      
      this.cdr.markForCheck();
      
      // Wait for Angular to re-render the template with the custom view container
      if (this.dialogData.customViewComponent) {
        setTimeout(() => this.loadCustomView(), 100);
      }
    }, 0);
  }
  
  private generateFieldsFromData(data: any): DialogField[] {
    const fields: DialogField[] = [];
    
    // Common fields based on resource type
    if (this.dialogData.resourceType === 'users') {
      fields.push(
        { key: 'id', label: 'ID', type: 'number', value: data.id, readonly: true },
        { key: 'name', label: 'Name', type: 'text', value: data.name, required: true },
        { key: 'email', label: 'Email', type: 'email', value: data.email, required: true },
        { key: 'role', label: 'Role', type: 'select', value: data.role, required: true,
          options: [
            { value: 'admin', label: 'Admin' },
            { value: 'user', label: 'User' },
            { value: 'moderator', label: 'Moderator' }
          ]
        }
      );
    }
    
    return fields;
  }
  
  private updateDialogData(freshData: any): void {
    this.dialogData.data = freshData;
    // Update field values with fresh data
    if (this.dialogData.fields) {
      this.dialogData.fields.forEach(field => {
        if (freshData[field.key] !== undefined) {
          field.value = freshData[field.key];
        }
      });
    }
    this.initializeFormData();
  }
  
  canToggleMode(): boolean {
    // Can toggle between view and edit, but not from create mode
    return !this.isCreateMode && this.dialogData.data;
  }
  
  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  onFileSelected(event: Event, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.formData[fieldKey] = input.files[0];
      this.formData[fieldKey + '_name'] = input.files[0].name;
    }
  }

  removeFile(fieldKey: string): void {
    this.formData[fieldKey] = null;
    this.formData[fieldKey + '_name'] = null;
  }
  
  onSave(): void {
    // Validate required fields
    if (!this.dialogData.fields) return;
    
    const missingFields = this.dialogData.fields
      .filter(field => field.required && !this.formData[field.key])
      .map(field => field.label);
    
    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    // Clean up form data - remove empty password field for updates
    const cleanedData = { ...this.formData };
    if (this.isEditMode && cleanedData.password === '') {
      delete cleanedData.password;
    }
    if (this.isEditMode && cleanedData.password_confirmation === '') {
      delete cleanedData.password_confirmation;
    }

    // Convert multi-select boolean maps back to arrays
    if (this.dialogData.fields) {
      this.dialogData.fields.forEach(field => {
        if (field.type === 'multi-select' && field.options && cleanedData[field.key]) {
          cleanedData[field.key] = field.options
            .filter(option => cleanedData[field.key][option.value])
            .map(option => option.value);
        }
      });
    }
    
    this.dialogRef.close({
      action: 'save',
      data: cleanedData
    });
  }
}
