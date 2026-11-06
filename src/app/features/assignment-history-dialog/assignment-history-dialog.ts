import { Component, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AssignmentService, AssignedArticle, AssignmentEvent } from '../../core/services/assignments';

@Component({
  selector: 'app-assignment-history-dialog', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './assignment-history-dialog.html', styleUrl: './assignment-history-dialog.scss',
  encapsulation: ViewEncapsulation.None
})
export class AssignmentHistoryDialogComponent implements OnInit, OnDestroy {
  readonly data: AssignedArticle = inject(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignmentHistoryDialogComponent>);
  private readonly api = inject(AssignmentService);
  events: AssignmentEvent[] = [];
  loading = false;
  isSaving = false;
  amount = 1;
  observation = '';
  errorMessage = '';
  evidenceUrl: string | null = null;

  get canReturn(): boolean { return Number(this.amount) > 0 && Number(this.amount) <= Number(this.data.remainingQuantity) && !this.isSaving; }
  ngOnInit(): void {
    this.loading = true;
    this.api.events(this.data.id).subscribe({ next: rows => { this.events = rows; this.loading = false; }, error: () => { this.loading = false; this.errorMessage = 'No se pudo cargar el historial.'; } });
    if (this.data.hasEvidence) this.api.getEvidence(this.data.id).subscribe({
      next: file => this.evidenceUrl = URL.createObjectURL(file), error: () => {} });
  }
  ngOnDestroy(): void { if (this.evidenceUrl) URL.revokeObjectURL(this.evidenceUrl); }
  returnArticle(): void {
    if (!this.canReturn) return;
    this.isSaving = true;
    this.errorMessage = '';
    this.api.returnArticle(this.data.id, Number(this.amount), this.observation).subscribe({
      next: () => this.dialogRef.close(true),
      error: err => { this.isSaving = false; this.errorMessage = String(err?.error?.error ?? 'No se pudo registrar la devolución.'); }
    });
  }
}
