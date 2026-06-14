# Admin Dialog Component

A reusable Material Dialog component for viewing and editing admin resources (Users, Machines, Reservations, etc.).

## Features

- **Three modes**: View, Edit, and Create
- **Dynamic form fields**: Automatically generates form fields based on configuration
- **Material Design**: Uses Angular Material components for consistent UI
- **Type-safe**: Full TypeScript support with interfaces
- **Reusable**: Works with any resource type through configuration

## Usage

### Using AdminDialogService (Recommended)

```typescript
import { AdminDialogService } from '../admin-dialog/admin-dialog.service';

constructor(private dialogService: AdminDialogService) {}

// View mode
viewItem(item: any) {
  this.dialogService.openViewDialog(
    'users',
    `View User - ${item.name}`,
    item,
    this.getFieldsConfig(item)
  );
}

// Edit mode
editItem(item: any) {
  this.dialogService.openEditDialog(
    'users',
    `Edit User - ${item.name}`,
    item,
    this.getFieldsConfig(item)
  ).subscribe((result) => {
    if (result && result.action === 'save') {
      // Handle save
      console.log('Updated data:', result.data);
    }
  });
}

// Create mode
createItem() {
  this.dialogService.openCreateDialog(
    'users',
    'Create New User',
    this.getFieldsConfig({})
  ).subscribe((result) => {
    if (result && result.action === 'save') {
      // Handle create
      console.log('New data:', result.data);
    }
  });
}
```

### Field Configuration

```typescript
import { DialogField } from '../admin-dialog/admin-dialog';

private getFieldsConfig(item: any): DialogField[] {
  return [
    { 
      key: 'id', 
      label: 'ID', 
      type: 'number', 
      value: item.id, 
      readonly: true 
    },
    { 
      key: 'name', 
      label: 'Name', 
      type: 'text', 
      value: item.name, 
      required: true 
    },
    { 
      key: 'email', 
      label: 'Email', 
      type: 'email', 
      value: item.email, 
      required: true 
    },
    { 
      key: 'role', 
      label: 'Role', 
      type: 'select', 
      value: item.role, 
      required: true,
      options: [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' }
      ]
    },
    { 
      key: 'notes', 
      label: 'Notes', 
      type: 'textarea', 
      value: item.notes,
      placeholder: 'Enter notes...' 
    }
  ];
}
```

## Field Types

- `text`: Text input
- `email`: Email input with validation
- `number`: Number input
- `date`: Date picker
- `datetime-local`: Date and time picker
- `select`: Dropdown with options
- `textarea`: Multi-line text input

## Field Properties

- `key`: Property name in the data object
- `label`: Display label for the field
- `type`: Input type (see Field Types above)
- `value`: Initial value
- `required`: Whether the field is required (optional)
- `readonly`: Whether the field is read-only (optional)
- `options`: Array of options for select fields (optional)
- `placeholder`: Placeholder text (optional)

## Dialog Result

The dialog returns a `DialogResult` object:

```typescript
interface DialogResult {
  action: 'save' | 'cancel';
  data?: any;  // Form data if action is 'save'
}
```

## Styling

The dialog is styled with a dark theme matching the admin interface. You can customize the styling in `admin-dialog.scss`.

## Examples

See the following components for full implementation examples:
- `src/app/admin/users/users.ts`
- `src/app/admin/machines/machines.ts`
- `src/app/admin/reservations/reservations.ts`
