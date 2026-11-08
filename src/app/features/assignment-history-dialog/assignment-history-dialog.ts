import { CleanArticleNamePipe } from '../../shared/clean-article-name.pipe';
import { InventoryContextService } from '../../core/services/inventory-context';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AssignmentService, AssignedArticle, AssignmentEvent } from '../../core/services/assignments';
import { SerialUnitsService, SerialUnit } from '../../core/services/serial-units';

@Component({
  selector: 'app-assignment-history-dialog', standalone: true,
  imports: [CleanArticleNamePipe, CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './assignment-history-dialog.html', styleUrl: './assignment-history-dialog.scss',
  encapsulation: ViewEncapsulation.None
})
export class AssignmentHistoryDialogComponent implements OnInit, OnDestroy {
  readonly data: AssignedArticle = inject(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignmentHistoryDialogComponent>);
  private readonly api = inject(AssignmentService);
  private readonly serialsApi = inject(SerialUnitsService);
  get inventoryLabel(): string {
    const inventory = this.inventoryContext.options.find(i => i.id === this.data.inventoryId);
    return inventory?.alias?.trim() || inventory?.inventoryName || `Inventario #${this.data.inventoryId}`;
  }
  private readonly inventoryContext = inject(InventoryContextService);
  private readonly cdr = inject(ChangeDetectorRef);
  events: AssignmentEvent[] = [];
  loading = false;
  isSaving = false;
  amount = 1;
  observation = '';
  assignedSerials:SerialUnit[]=[]; selectedSerialIds:number[]=[]; serialLoading=true;
  get isSerialized():boolean{return this.assignedSerials.length>0;}
  toggleSerial(id:number,on:boolean):void {
    this.selectedSerialIds=on?[...this.selectedSerialIds,id]:this.selectedSerialIds.filter(x=>x!==id);
    this.amount=this.selectedSerialIds.length;
  }
  errorMessage = '';
  evidenceUrl: string | null = null;
  evidenceStatus = '';

  get canReturn(): boolean { return Number(this.amount) > 0 && Number(this.amount) <= Number(this.data.remainingQuantity) && !this.isSaving && !this.serialLoading &&
    (!this.isSerialized || this.selectedSerialIds.length === Number(this.amount)); }
  ngOnInit(): void {
    this.loading = true;
    this.api.events(this.data.id).subscribe({ next: rows => { this.events = rows; this.loading = false; this.cdr.markForCheck(); }, error: () => { this.loading = false; this.errorMessage = 'No se pudo cargar el historial.'; this.cdr.markForCheck(); } });
    this.serialsApi.assigned(this.data.id).subscribe({next:rows=>{this.assignedSerials=rows;this.serialLoading=false; this.cdr.markForCheck();},
      error:()=>{this.serialLoading=false;this.errorMessage='No se pudieron consultar las series asignadas.'; this.cdr.markForCheck();}});
    // UX_FINAL_EVIDENCIA_CUSTODIA: consultar incluso custodias históricas.
    this.api.getEvidence(this.data.id).subscribe({
      next: file => {
        if (this.evidenceUrl) URL.revokeObjectURL(this.evidenceUrl);
        this.evidenceUrl = URL.createObjectURL(file);
        this.evidenceStatus = '';
        this.cdr.markForCheck();
      },
      error: err => {
        this.evidenceStatus = err?.status === 404
          ? 'No se encontró una fotografía guardada para esta custodia.'
          : 'No se pudo cargar la fotografía de esta custodia.';
        this.cdr.markForCheck();
      }
    });
  }
  ngOnDestroy(): void { if (this.evidenceUrl) URL.revokeObjectURL(this.evidenceUrl); }
  returnArticle(): void {
    if (!this.canReturn) return;
    this.isSaving = true;
    this.errorMessage = '';
    this.api.returnArticle(this.data.id, Number(this.amount), this.observation,crypto.randomUUID(),this.isSerialized?this.selectedSerialIds:[]).subscribe({
      next: () => this.dialogRef.close(true),
      error: err => { this.isSaving = false; this.errorMessage = String(err?.error?.error ?? 'No se pudo registrar la devolución.'); }
    });
  }
}
