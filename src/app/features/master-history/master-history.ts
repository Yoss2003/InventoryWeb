import { CleanArticleNamePipe } from '../../shared/clean-article-name.pipe';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../shared/toast/toast.service';

interface MasterMovementRow {
  id: number;
  movementDate: string;
  actionId: number;
  amount: number | null;
  employeeId: number | null;
  observation: string | null;
  inventoryId: number;
  inventoryName: string;
  userId: number;
  username: string;
  actorUserId?: number | null;
  articleId: number;
  articleName: string;
  articleCode: string;
}
interface MasterHistoryResponse { items: MasterMovementRow[]; total: number; page: number; pageSize: number; }

@Component({
  selector: 'app-master-history', standalone: true,
  imports: [CleanArticleNamePipe, CommonModule, FormsModule, MatIconModule],
  templateUrl: './master-history.html', styleUrl: './master-history.scss'
})
export class MasterHistoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  /* FASE 4.1 */
  readonly api = 'https://localhost:7295/api/Movements/master/history';
  items: MasterMovementRow[] = [];
  total = 0;
  loading = false;
  page = 1;
  pageSize = 30;
  inventoryId = '';
  userId = '';
  actorUserId = '';
  actionId = '';
  from = '';
  to = '';
  error = '';

  ngOnInit(): void { this.load(); }
  applyFilters(): void { this.page = 1; this.load(); }
  next(): void { if (this.page * this.pageSize < this.total) { this.page++; this.load(); } }
  previous(): void { if (this.page > 1) { this.page--; this.load(); } }

  load(): void {
    if (this.loading) return;
    let params = new HttpParams().set('page', this.page).set('pageSize', this.pageSize);
    for (const [key, value] of [
      ['inventoryId', this.inventoryId], ['userId', this.userId],
      ['actorUserId', this.actorUserId], ['actionId', this.actionId]
    ] as const) {
      if (value.trim() !== '') params = params.set(key, value.trim());
    }
    if (this.from) params = params.set('from', new Date(`${this.from}T00:00:00`).toISOString());
    if (this.to) params = params.set('to', new Date(`${this.to}T23:59:59`).toISOString());
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    this.http.get<MasterHistoryResponse>(this.api, { params }).subscribe({
      next: result => { this.items = result.items ?? []; this.total = result.total ?? 0; this.loading = false; this.cdr.markForCheck(); },
      error: err => {
        this.loading = false;
        this.error = String(err?.error?.error || 'No se pudo consultar el historial de la empresa.');
        this.toast.error(this.error, 'Historial administrativo');
        this.cdr.markForCheck();
      }
    });
  }
}
