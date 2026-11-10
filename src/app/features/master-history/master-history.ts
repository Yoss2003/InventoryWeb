import { UiControlDirective } from '../../shared/ui/v2/ui-control.directive';
import { UiButtonDirective } from '../../shared/ui/v2/ui-button.directive';
import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { CleanArticleNamePipe } from '../../shared/clean-article-name.pipe';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
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
interface HistoryInventory { id: number; inventoryName: string; alias?: string | null; userId: number; isMaster: boolean; }
interface HistoryUser { id: number; username: string; firstName?: string; lastName?: string; }

@Component({
  selector: 'app-master-history', standalone: true,
  imports: [UiControlDirective, UiButtonDirective, UiPageHeadingComponent, CleanArticleNamePipe, CommonModule, FormsModule, MatIconModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-PE' }],
  templateUrl: './master-history.html', styleUrl: './master-history.scss'
})
export class MasterHistoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  /* FASE 4.1 */
  readonly api = 'https://localhost:7295/api/Movements/master/history';
  private readonly apiRoot = 'https://localhost:7295/api';
  inventoryOptions: HistoryInventory[] = [];
  userOptions: HistoryUser[] = [];
  optionsError = '';
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

  /* Fechas civiles para Angular Material; no cambian los parámetros de la API. */
  get fromDate(): Date | null { return this.from ? new Date(this.from + 'T12:00:00') : null; }
  get toDate(): Date | null { return this.to ? new Date(this.to + 'T12:00:00') : null; }
  setFromDate(date: Date | null): void { this.from = this.dateOnly(date); }
  setToDate(date: Date | null): void { this.to = this.dateOnly(date); }
  private dateOnly(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }
  ngOnInit(): void { this.loadFilterOptions(); this.load(); }
  userLabel(user: HistoryUser): string {
    const name=[user.firstName,user.lastName].filter(Boolean).join(' ').trim();
    return name && name.toLocaleLowerCase('es')!==user.username.toLocaleLowerCase('es')
      ? name+' ('+user.username+')' : user.username;
  }
  inventoryLabel(inventory: HistoryInventory): string {
    const name=(inventory.alias || inventory.inventoryName || 'Sin nombre').trim();
    const owner=this.userOptions.find(x=>x.id===inventory.userId);
    return owner ? name+' · '+owner.username : name;
  }
  responsibleName(id: number | null | undefined): string {
    if (!id) return '—';
    const user=this.userOptions.find(x=>x.id===id);
    return user ? this.userLabel(user) : 'Usuario no disponible';
  }
  loadFilterOptions(): void {
    this.optionsError='';
    this.http.get<HistoryInventory[]>(this.apiRoot+'/Inventories').subscribe({
      next:rows=>{
        this.inventoryOptions=(Array.isArray(rows)?rows:[]).filter(x=>!x.isMaster)
          .sort((a,b)=>this.inventoryLabel(a).localeCompare(this.inventoryLabel(b),'es'));
        this.cdr.markForCheck();
      },
      error:()=>{this.optionsError='No se pudieron cargar los inventarios para el filtro por nombre.';this.cdr.markForCheck();}
    });
    this.http.get<HistoryUser[]>(this.apiRoot+'/Users').subscribe({
      next:rows=>{
        this.userOptions=(Array.isArray(rows)?rows:[])
          .sort((a,b)=>this.userLabel(a).localeCompare(this.userLabel(b),'es'));
        this.cdr.markForCheck();
      },
      error:()=>{this.optionsError='No se pudieron cargar los usuarios para el filtro por nombre.';this.cdr.markForCheck();}
    });
  }
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
