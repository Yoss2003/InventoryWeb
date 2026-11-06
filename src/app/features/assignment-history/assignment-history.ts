import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ArticleService } from '../../core/services/articles';
import { MovementService } from '../../core/services/movement';
import { Article } from '../../core/models/article.model';
import { Movement } from '../../core/models/movement.model';
import { AssignmentHistoryDialogComponent } from '../assignment-history-dialog/assignment-history-dialog';

export interface AssignmentHistoryRow {
  movement: Movement;
  article: Article | null;
  articleName: string;
  articleCode: string;
  recipient: string;
  amount: number;
}

@Component({
  selector: 'app-assignment-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './assignment-history.html',
  styleUrl: './assignment-history.scss'
})
export class AssignmentHistoryComponent implements OnInit {
  private readonly articlesApi = inject(ArticleService);
  private readonly movementsApi = inject(MovementService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  rows: AssignmentHistoryRow[] = [];
  search = '';
  currentTab: 'history' | 'received' = 'history';
  loading = false;
  errorMessage = '';

  get filteredRows(): AssignmentHistoryRow[] {
    const q = this.search.trim().toLocaleLowerCase('es');
    if (!q) return this.rows;
    return this.rows.filter(r =>
      [r.articleName, r.articleCode, r.recipient, r.movement.observation ?? '', String(r.movement.id ?? '')]
        .some(value => value.toLocaleLowerCase('es').includes(q))
    );
  }

  get distinctArticles(): number {
    return new Set(this.rows.map(r => r.movement.articleId)).size;
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      movements: this.movementsApi.getMovements(),
      articles: this.articlesApi.getArticles()
    }).subscribe({
      next: ({ movements, articles }) => {
        const articleById = new Map<number, Article>(articles.map(a => [Number(a.id), a]));
        this.rows = movements
          // En el backend actual ActionId 3 indica movimiento de retiro/traspaso.
          // Esto es HISTORIAL, NO saldo ni custodia vigente: pueden faltar devoluciones.
          .filter(m => Number(m.actionId) === 3)
          .map(m => {
            const article = articleById.get(Number(m.articleId)) ?? null;
            return {
              movement: m,
              article,
              articleName: article?.name?.trim() || `Artículo #${m.articleId}`,
              articleCode: article?.code?.trim() || '—',
              recipient: m.recipient?.trim() || 'Sin destinatario registrado',
              amount: Number(m.amount ?? 0)
            };
          })
          .sort((a, b) => new Date(b.movement.movementDate).getTime() - new Date(a.movement.movementDate).getTime());
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.rows = [];
        this.loading = false;
        this.errorMessage = 'No fue posible consultar los movimientos. Verifica la conexión con la API.';
        this.cdr.markForCheck();
      }
    });
  }

  openDetail(row: AssignmentHistoryRow): void {
    this.dialog.open(AssignmentHistoryDialogComponent, {
      data: row,
      width: 'min(660px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      autoFocus: false,
      panelClass: 'assignment-history-dialog-panel'
    });
  }
}
