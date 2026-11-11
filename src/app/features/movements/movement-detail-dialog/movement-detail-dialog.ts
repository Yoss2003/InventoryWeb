import { CleanArticleNamePipe } from '../../../shared/clean-article-name.pipe';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Movement } from '../../../core/models/movement.model';

import { SalesService, SaleInstallmentsSummary } from '../../../core/services/sales';

interface EmployeeName {firstName?:string|null;lastName?:string|null;}
@Component({selector:'app-movement-detail-dialog',standalone:true,
  imports:[CleanArticleNamePipe, CommonModule,MatDialogModule,MatIconModule],
  templateUrl:'./movement-detail-dialog.html',styleUrl:'./movement-detail-dialog.scss'})
export class MovementDetailDialogComponent implements OnInit {
  readonly dialogRef=inject(MatDialogRef<MovementDetailDialogComponent>);
  readonly data:{movement:Movement;articleName:string;articleCode:string}=inject(MAT_DIALOG_DATA);
  private readonly http=inject(HttpClient);
  private readonly salesApi=inject(SalesService);
  private readonly cdr=inject(ChangeDetectorRef);
  responsibleName='—';
  credit: SaleInstallmentsSummary | null = null;
  creditLoading = false;
  creditError = '';

  get creditSaleId(): number | null {
    const found = String(this.data.movement.documentNumber ?? '').match(/^VENTA-(\d+)$/);
    return found ? Number(found[1]) : null;
  }
  get isCreditSale(): boolean {
    return this.creditSaleId !== null && String(this.data.movement.paymentMethod ?? '').trim().toLowerCase() === 'cuotas';
  }
  creditStatusLabel(status: string): string {
    return ({ Paid: 'Pagada', Partial: 'Abonada parcialmente', Overdue: 'Vencida', Pending: 'Pendiente', Cancelled: 'Anulada' } as Record<string,string>)[status] ?? status;
  }

  private loadCredit(): void {
    const saleId = this.creditSaleId;
    if (!this.isCreditSale || saleId === null) return;
    this.creditLoading = true;
    this.salesApi.getInstallments(saleId).subscribe({
      next: details => { this.credit = details; this.creditLoading = false; this.cdr.markForCheck(); },
      error: err => { this.creditError = String(err?.error?.error || 'No se pudo consultar el cronograma de la venta.'); this.creditLoading = false; this.cdr.markForCheck(); }
    });
  }
  ngOnInit():void {
    this.loadCredit();
    const id=Number(this.data.movement.employeeId);
    if(!id || id<=0){this.responsibleName='Sin responsable asociado';return;}
    this.responsibleName='Consultando responsable…';
    this.http.get<EmployeeName>(`https://localhost:7295/api/Employees/${id}`).subscribe({
      next:person=>{
        this.responsibleName=[person.firstName,person.lastName].map(p=>String(p??'').trim()).filter(Boolean).join(' ')||'Nombre no registrado';
        this.cdr.markForCheck();
      },
      error:()=>{this.responsibleName='Responsable no disponible';this.cdr.markForCheck();}
    });
  }
}
