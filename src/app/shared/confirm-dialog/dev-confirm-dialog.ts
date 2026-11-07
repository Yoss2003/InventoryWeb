import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DevConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  icon: string;
}

@Component({
  selector: 'app-dev-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  templateUrl: './dev-confirm-dialog.html',
  styleUrl: './dev-confirm-dialog.scss'
})
export class DevConfirmDialogComponent {
  readonly data = inject<DevConfirmDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<DevConfirmDialogComponent, boolean>);
}
