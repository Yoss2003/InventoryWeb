import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { AssignmentHistoryRow } from '../assignment-history/assignment-history';

@Component({
  selector: 'app-assignment-history-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule],
  templateUrl: './assignment-history-dialog.html',
  styleUrl: './assignment-history-dialog.scss',
  encapsulation: ViewEncapsulation.None
})
export class AssignmentHistoryDialogComponent {
  readonly data: AssignmentHistoryRow = inject(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignmentHistoryDialogComponent>);
}
