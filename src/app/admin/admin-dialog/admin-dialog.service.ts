import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { AdminDialog, AdminDialogData, DialogResult, DialogField, DialogMode, ResourceType } from './admin-dialog';

/**
 * Service to simplify opening admin dialogs for different resource types
 */
@Injectable({
  providedIn: 'root'
})
export class AdminDialogService {
  constructor(private dialog: MatDialog) {}
  
  /**
   * Open a dialog for viewing a resource
   */
  openViewDialog(
    resourceType: ResourceType,
    title: string,
    data: any,
    fields: DialogField[]
  ): MatDialogRef<AdminDialog> {
    const dialogData: AdminDialogData = {
      mode: 'view',
      resourceType,
      title,
      data,
      fields: this.makeFieldsReadonly(fields)
    };
    
    return this.dialog.open(AdminDialog, {
      width: '600px',
      data: dialogData
    });
  }
  
  /**
   * Open a dialog for editing a resource
   */
  openEditDialog(
    resourceType: ResourceType,
    title: string,
    data: any,
    fields: DialogField[]
  ): Observable<DialogResult | undefined> {
    const dialogData: AdminDialogData = {
      mode: 'edit',
      resourceType,
      title,
      data,
      fields
    };
    
    const dialogRef = this.dialog.open(AdminDialog, {
      width: '600px',
      data: dialogData
    });
    
    return dialogRef.afterClosed();
  }
  
  /**
   * Open a dialog for creating a new resource
   */
  openCreateDialog(
    resourceType: ResourceType,
    title: string,
    fields: DialogField[]
  ): Observable<DialogResult | undefined> {
    const dialogData: AdminDialogData = {
      mode: 'create',
      resourceType,
      title,
      fields
    };
    
    const dialogRef = this.dialog.open(AdminDialog, {
      width: '600px',
      data: dialogData
    });
    
    return dialogRef.afterClosed();
  }
  
  /**
   * Helper method to make all fields readonly
   */
  private makeFieldsReadonly(fields: DialogField[]): DialogField[] {
    return fields.map(field => ({
      ...field,
      readonly: true
    }));
  }
  
  /**
   * Generic method to open any dialog configuration
   */
  openDialog(dialogData: AdminDialogData, width: string = '600px'): Observable<DialogResult | undefined> {
    const dialogRef = this.dialog.open(AdminDialog, {
      width,
      data: dialogData
    });
    
    return dialogRef.afterClosed();
  }
}
