import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { AssignmentService, AssignedArticle } from '../../core/services/assignments';
import { AssignmentHistoryDialogComponent } from '../assignment-history-dialog/assignment-history-dialog';

@Component({
  selector: 'app-assignment-history', standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './assignment-history.html', styleUrl: './assignment-history.scss'
})
export class AssignmentHistoryComponent implements OnInit {
  private readonly api = inject(AssignmentService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  outgoing: AssignedArticle[] = [];
  received: AssignedArticle[] = [];
  currentTab: 'history' | 'received' = 'history';
  search = '';
  loading = false;
  errorMessage = '';

  get rows(): AssignedArticle[] { return this.currentTab === 'received' ? this.received : this.outgoing; }
  get filteredRows(): AssignedArticle[] {
    const query = this.search.trim().toLocaleLowerCase('es');
    if (!query) return this.rows;
    return this.rows.filter(r => [r.articleName, r.articleCode, r.recipientName, r.observation || '', String(r.id)]
      .some(v => v.toLocaleLowerCase('es').includes(query)));
  }
  get pendingQuantity(): number { return this.outgoing.reduce((n,a)=>n+Number(a.remainingQuantity),0); }
  get activeAssignments(): number { return this.outgoing.filter(a=>a.remainingQuantity>0).length; }
  get distinctArticles(): number { return new Set(this.outgoing.map(r=>r.articleId)).size; }

  ngOnInit(): void { this.loadHistory(); }
  loadHistory(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({ outgoing: this.api.outgoing(), received: this.api.received() }).subscribe({
      next: ({outgoing,received}) => {
        this.outgoing = outgoing;
        this.received = received;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.errorMessage = String(err?.error?.error ?? 'No se pudieron cargar las asignaciones. Verifica la API y la migración.');
        this.cdr.markForCheck();
      }
    });
  }
  openDetail(row: AssignedArticle): void {
    const ref = this.dialog.open(AssignmentHistoryDialogComponent, {
      data: row,
      width: 'min(710px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      autoFocus: false,
      panelClass: 'assignment-history-dialog-panel'
    });
    ref.afterClosed().subscribe(changed => { if (changed) this.loadHistory(); });
  }
}
