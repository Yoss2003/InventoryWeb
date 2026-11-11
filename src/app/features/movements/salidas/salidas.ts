import { UiEmptyStateComponent } from '../../../shared/ui/v2/ui-empty-state.component';
import { UiStatusComponent } from '../../../shared/ui/v2/ui-status.component';
import { UiTableActionDirective } from '../../../shared/ui/v2/ui-table-action.directive';
import { UiButtonDirective } from '../../../shared/ui/v2/ui-button.directive';
import { UiPageHeadingComponent } from '../../../shared/ui/v2/ui-page-heading.component';
import { cleanArticleDisplayName } from '../../../shared/clean-article-name.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TabViewTransitionDirective } from '../../../shared/ui/tab-view-transition.directive';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { forkJoin, filter, take } from 'rxjs';
import { MovementService } from '../../../core/services/movement';
import { ConfirmationDialogService } from '../../../shared/confirm-dialog/confirmation-dialog.service';
import { SalesService } from '../../../core/services/sales';
import { ArticleService } from '../../../core/services/articles';
import { InventoryContextService } from '../../../core/services/inventory-context';
import { Movement } from '../../../core/models/movement.model';
import { Article } from '../../../core/models/article.model';
import { TraspasoFormComponent } from '../traspaso-form/traspaso-form';
import { QuickSaleFormComponent } from '../quick-sale-form/quick-sale-form';
import { MovementDetailDialogComponent } from '../movement-detail-dialog/movement-detail-dialog';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

import { UiSearchComponent } from '../../../shared/ui/ui-search.component';

@Component({selector:'app-salidas',standalone:true,imports:[UiEmptyStateComponent, UiStatusComponent, UiTableActionDirective, UiButtonDirective, UiPageHeadingComponent, CommonModule,MatIconModule,MatTabsModule,TabViewTransitionDirective,LoadingIndicatorComponent,UiSearchComponent],templateUrl:'./salidas.html',styleUrl:'./salidas.scss'})
export class SalidasComponent implements OnInit {
  private readonly movementsApi=inject(MovementService);
  private readonly salesApi=inject(SalesService);
  private readonly articlesApi=inject(ArticleService);
  private readonly inventoryContext=inject(InventoryContextService);
  private readonly dialog=inject(MatDialog);
  private readonly confirms=inject(ConfirmationDialogService);
  private readonly cdr=inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  private readonly router=inject(Router);
  traspasos:Movement[]=[]; ventas:Movement[]=[];
  private articles=new Map<number,Article>();
  cancelledIds=new Set<number>();cancelledSaleIds=new Set<number>();
  loading=false;hasLoaded=false;error='';
  search='';
  private matchesQuery(m: Movement): boolean {
    const q = this.search.trim().toLocaleLowerCase('es');
    return !q || [
      this.articleName(m.articleId), this.articleCode(m.articleId),
      m.recipient, m.documentNumber, m.observation, m.paymentMethod
    ].some(value => String(value ?? '').toLocaleLowerCase('es').includes(q));
  }
  get filteredTransfers(): Movement[] { return this.traspasos.filter(m => this.matchesQuery(m)); }
  get filteredSales(): Movement[] { return this.ventas.filter(m => this.matchesQuery(m)); }
  ngOnInit():void{this.inventoryContext.activeInventoryId$.pipe(filter(id=>id!==null),take(1)).subscribe(()=>this.loadRealData());}
  loadRealData():void{
    if(this.loading)return;
    this.loading=true;this.error='';this.cdr.markForCheck();
    forkJoin({movements:this.movementsApi.getMovements(),articles:this.articlesApi.getArticles(),reversals:this.movementsApi.getCancellations(),sales:this.salesApi.getCancellations()}).subscribe({
      next:({movements,articles,reversals,sales})=>{
        const inventoryArticles=articles.filter(a=>a.inventoryId===this.inventoryContext.activeInventoryId);
        const ids=new Set(inventoryArticles.map(a=>a.id));
        this.articles=new Map(inventoryArticles.map(a=>[a.id,a]));
        this.cancelledIds=new Set(reversals.map(x=>x.originalMovementId));
        this.cancelledSaleIds=new Set(sales.map(x=>x.saleId));
        const records=movements.filter(m=>ids.has(m.articleId)).sort((a,b)=>new Date(b.movementDate).getTime()-new Date(a.movementDate).getTime());
        this.ventas=records.filter(m=>m.actionId===2&&!!m.paymentMethod&&m.paymentMethod!=='N/A');
        this.traspasos=records.filter(m=>m.actionId===3||(m.actionId===2&&!m.paymentMethod));
        this.loading=false;this.hasLoaded=true;this.cdr.markForCheck();
      },error:err=>{
        this.loading=false;this.hasLoaded=true;
        this.error=String(err?.error?.error??'No fue posible actualizar las salidas. Los datos anteriores pueden estar desactualizados.');
        this.toast.error(this.error);this.cdr.markForCheck();
      }
    });
  }
  articleName(id:number):string{return cleanArticleDisplayName(this.articles.get(id)?.name ?? `Artículo #${id}`);}
  articleCode(id:number):string{return this.articles.get(id)?.code??'—';}
  total(m:Movement):number{return Number(m.amount??0)*Number(m.salePrice??0);}
  saleId(m:Movement):number|null{
    const match=String(m.documentNumber??'').match(/^VENTA-(\d+)$/);
    return match?Number(match[1]):null;
  }
  isCancelled(m:Movement):boolean{return this.cancelledIds.has(Number(m.id))||(this.saleId(m)!==null&&this.cancelledSaleIds.has(this.saleId(m)!));}
  newTransfer():void{
    const ref=this.dialog.open(TraspasoFormComponent,{panelClass:'inv-seven-modal',enterAnimationDuration:260,exitAnimationDuration:220,width:'min(710px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',disableClose:true});
    ref.afterClosed().subscribe(ok=>{if(ok)this.loadRealData();});
  }
  newSale():void{
    const ref=this.dialog.open(QuickSaleFormComponent,{panelClass:'inv-seven-modal',enterAnimationDuration:260,exitAnimationDuration:220,width:'min(640px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',disableClose:true});
    ref.afterClosed().subscribe(ok=>{if(ok)this.loadRealData();});
  }
  showDetail(m:Movement):void{
    this.dialog.open(MovementDetailDialogComponent,{panelClass:'inv-seven-modal',enterAnimationDuration:260,exitAnimationDuration:220,data:{movement:m,articleName:this.articleName(m.articleId),articleCode:this.articleCode(m.articleId)},width:'min(650px,calc(100vw - 24px))'});
  }
  openAssignments(event:Event):void{event.stopPropagation();void this.router.navigate(['/dashboard/asignaciones']);}
  cancelMovement(m:Movement,event:Event):void{
    event.stopPropagation();if(!m.id||this.isCancelled(m))return;
    if(m.actionId===3){this.openAssignments(event);return;}
    if(this.saleId(m)!==null){this.cancelSale(m,event);return;}
    this.confirms.requestReason({
      title:'Anular salida',
      message:'Se revertirá el movimiento y se actualizará el stock. Indica el motivo para continuar.',
      confirmLabel:'Anular salida',tone:'danger',icon:'undo',
      reasonLabel:'Motivo de la anulación',
      reasonPlaceholder:'Describe por qué se anula esta salida...'
    }).subscribe(reason=>{
      if(!reason)return;
      this.movementsApi.cancelMovement(m.id!,reason).subscribe({
        next:()=>{this.toast.success('Movimiento revertido y stock actualizado.');this.loadRealData();},
        error:err=>this.toast.error(String(err?.error?.error??'No se pudo anular el movimiento.'))
      });
    });
  }
  cancelSale(m:Movement,event:Event):void{
    event.stopPropagation();const id=this.saleId(m);
    if(!id){this.toast.warning('La venta antigua no tiene identificador para anularla desde esta pantalla.');return;}
    if(this.cancelledSaleIds.has(id))return;
    this.confirms.requestReason({
      title:`Anular venta #${id}`,
      message:'Esta operación revertirá el stock si el servidor permite la anulación. Indica el motivo para continuar.',
      confirmLabel:'Anular venta',tone:'danger',icon:'receipt_long',
      reasonLabel:'Motivo de la anulación',
      reasonPlaceholder:'Describe por qué se anula esta venta...'
    }).subscribe(reason=>{
      if(!reason || this.cancelledSaleIds.has(id))return;
      this.salesApi.cancelSale(id,reason).subscribe({
        next:()=>{this.toast.success('Venta anulada; stock devuelto.');this.loadRealData();},
        error:err=>this.toast.error(String(err?.error?.error??'No se pudo anular la venta.'))
      });
    });
  }
}
