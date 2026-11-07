import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MovementService } from '../../../core/services/movement';
import { SalesService } from '../../../core/services/sales';
import { ArticleService } from '../../../core/services/articles';
import { Movement } from '../../../core/models/movement.model';
import { Article } from '../../../core/models/article.model';
import { TraspasoFormComponent } from '../traspaso-form/traspaso-form';
import { QuickSaleFormComponent } from '../quick-sale-form/quick-sale-form';
import { MovementDetailDialogComponent } from '../movement-detail-dialog/movement-detail-dialog';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

@Component({selector:'app-salidas',standalone:true,imports:[CommonModule,MatIconModule,MatTabsModule,LoadingIndicatorComponent],templateUrl:'./salidas.html',styleUrl:'./salidas.scss'})
export class SalidasComponent implements OnInit {
  private readonly movementsApi=inject(MovementService);
  private readonly salesApi=inject(SalesService);
  private readonly articlesApi=inject(ArticleService);
  private readonly dialog=inject(MatDialog);
  private readonly cdr=inject(ChangeDetectorRef);
  private readonly snackbar=inject(MatSnackBar);
  private readonly router=inject(Router);
  traspasos:Movement[]=[]; ventas:Movement[]=[];
  private articles=new Map<number,Article>();
  cancelledIds=new Set<number>();cancelledSaleIds=new Set<number>();
  loading=false;hasLoaded=false;error='';
  ngOnInit():void{this.loadRealData();}
  loadRealData():void{
    if(this.loading)return;
    this.loading=true;this.error='';this.cdr.markForCheck();
    forkJoin({movements:this.movementsApi.getMovements(),articles:this.articlesApi.getArticles(),reversals:this.movementsApi.getCancellations(),sales:this.salesApi.getCancellations()}).subscribe({
      next:({movements,articles,reversals,sales})=>{
        this.articles=new Map(articles.map(a=>[a.id,a]));
        this.cancelledIds=new Set(reversals.map(x=>x.originalMovementId));
        this.cancelledSaleIds=new Set(sales.map(x=>x.saleId));
        const records=[...movements].sort((a,b)=>new Date(b.movementDate).getTime()-new Date(a.movementDate).getTime());
        this.ventas=records.filter(m=>m.actionId===2&&!!m.paymentMethod&&m.paymentMethod!=='N/A');
        this.traspasos=records.filter(m=>m.actionId===3||(m.actionId===2&&!m.paymentMethod));
        this.loading=false;this.hasLoaded=true;this.cdr.markForCheck();
      },error:err=>{
        this.loading=false;this.hasLoaded=true;
        this.error=String(err?.error?.error??'No fue posible actualizar las salidas. Los datos anteriores pueden estar desactualizados.');
        this.snackbar.open(this.error,'Cerrar',{duration:6000});this.cdr.markForCheck();
      }
    });
  }
  articleName(id:number):string{return this.articles.get(id)?.name??`Artículo #${id}`;}
  articleCode(id:number):string{return this.articles.get(id)?.code??'—';}
  total(m:Movement):number{return Number(m.amount??0)*Number(m.salePrice??0);}
  saleId(m:Movement):number|null{
    const match=String(m.documentNumber??'').match(/^VENTA-(\d+)$/);
    return match?Number(match[1]):null;
  }
  isCancelled(m:Movement):boolean{return this.cancelledIds.has(Number(m.id))||(this.saleId(m)!==null&&this.cancelledSaleIds.has(this.saleId(m)!));}
  newTransfer():void{
    const ref=this.dialog.open(TraspasoFormComponent,{width:'min(710px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',disableClose:true});
    ref.afterClosed().subscribe(ok=>{if(ok)this.loadRealData();});
  }
  newSale():void{
    const ref=this.dialog.open(QuickSaleFormComponent,{width:'min(640px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',disableClose:true});
    ref.afterClosed().subscribe(ok=>{if(ok)this.loadRealData();});
  }
  showDetail(m:Movement):void{
    this.dialog.open(MovementDetailDialogComponent,{data:{movement:m,articleName:this.articleName(m.articleId),articleCode:this.articleCode(m.articleId)},width:'min(650px,calc(100vw - 24px))'});
  }
  openAssignments(event:Event):void{event.stopPropagation();void this.router.navigate(['/dashboard/asignaciones']);}
  cancelMovement(m:Movement,event:Event):void{
    event.stopPropagation();if(!m.id||this.isCancelled(m))return;
    if(m.actionId===3){this.openAssignments(event);return;}
    if(this.saleId(m)!==null){this.cancelSale(m,event);return;}
    const reason=prompt('Motivo para anular el retiro y revertir el stock:');
    if(!reason?.trim())return;
    this.movementsApi.cancelMovement(m.id,reason.trim()).subscribe({
      next:()=>{this.snackbar.open('Movimiento revertido y stock actualizado.','Cerrar',{duration:3500});this.loadRealData();},
      error:err=>this.snackbar.open(String(err?.error?.error??'No se pudo anular el movimiento.'),'Cerrar',{duration:6000})
    });
  }
  cancelSale(m:Movement,event:Event):void{
    event.stopPropagation();const id=this.saleId(m);
    if(!id){this.snackbar.open('La venta antigua no tiene identificador para anularla desde esta pantalla.','Cerrar',{duration:4500});return;}
    if(this.cancelledSaleIds.has(id))return;
    const reason=prompt(`Motivo para anular la venta #${id}:`);
    if(!reason?.trim())return;
    this.salesApi.cancelSale(id,reason.trim()).subscribe({
      next:()=>{this.snackbar.open('Venta anulada; stock devuelto.','Cerrar',{duration:3500});this.loadRealData();},
      error:err=>this.snackbar.open(String(err?.error?.error??'No se pudo anular la venta.'),'Cerrar',{duration:6000})
    });
  }
}
