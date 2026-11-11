import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DevConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  icon: string;
  /** Opcional para operaciones que necesitan una razón, como anular ventas. */
  requiresReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  maxReasonLength?: number;
}

@Component({
  selector: 'app-dev-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, FormsModule],
  templateUrl: './dev-confirm-dialog.html',
  styleUrl: './dev-confirm-dialog.scss'
})
export class DevConfirmDialogComponent {
  readonly data = inject<DevConfirmDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<DevConfirmDialogComponent, boolean | string>);
  reason = '';

  get maxLength(): number { return this.data.maxReasonLength ?? 500; }
  get canConfirm(): boolean {
    return !this.data.requiresReason ||
      (this.reason.trim().length > 0 && this.reason.trim().length <= this.maxLength);
  }

  accept(): void {
    if (!this.canConfirm) return;
    this.dialogRef.close(this.data.requiresReason ? this.reason.trim() : true);
  }
}
