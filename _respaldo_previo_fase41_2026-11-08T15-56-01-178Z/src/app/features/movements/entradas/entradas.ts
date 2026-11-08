import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, filter, take } from 'rxjs';
import { ArticleService } from '../../../core/services/articles';
import { InventoryContextService } from '../../../core/services/inventory-context';
import { MovementService } from '../../../core/services/movement';
import { Article } from '../../../core/models/article.model';
import { Movement } from '../../../core/models/movement.model';
import { ArticleFormComponent } from '../../articles/article-form/article-form';
import { ArticleDetailDialogComponent } from '../../articles/article-detail-dialog/article-detail-dialog';
import { MovementForm } from '../movement-form/movement-form';
import { MovementDetailDialogComponent } from '../movement-detail-dialog/movement-detail-dialog';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

@Component({selector:'app-entradas',standalone:true,imports:[CommonModule,MatIconModule,MatTabsModule,LoadingIndicatorComponent],templateUrl:'./entradas.html',styleUrl:'./entradas.scss'})
export class EntradasComponent implements OnInit {
  private readonly dialog=inject(MatDialog);
  private readonly articles=inject(ArticleService);
  private readonly inventoryContext=inject(InventoryContextService);
  private readonly movementsApi=inject(MovementService);
  private readonly snackbar=inject(MatSnackBar);
  private readonly cdr=inject(ChangeDetectorRef);
  standard:Article[]=[];bulk:Article[]=[];serialized:Article[]=[];
  movements:Movement[]=[];
  private articleMap=new Map<number,Article>();
  loading=false;hasLoaded=false;error='';
  ngOnInit():void{this.inventoryContext.activeInventoryId$.pipe(filter(id=>id!==null),take(1)).subscribe(()=>this.loadRealData());}
  loadRealData():void{
    if(this.loading)return;
    this.loading=true;this.error='';this.cdr.markForCheck();
    forkJoin({articles:this.articles.getArticles(),movements:this.movementsApi.getMovements()}).subscribe({
      next:({articles,movements})=>{
        const inventoryArticles=articles.filter(a=>a.inventoryId===this.inventoryContext.activeInventoryId);
        const active=inventoryArticles.filter(a=>a.isActive);
        const ids=new Set(inventoryArticles.map(a=>a.id));
        const type=(a:Article):number=>{
          const v=String(a.tracking ?? a.trackingMode ?? 0).toLocaleLowerCase('es');
          return v==='serialized'||v==='serializado'||v==='1'?1:v==='bulk'||v==='a granel'||v==='2'?2:0;
        };
        this.standard=active.filter(a=>type(a)===0);
        this.serialized=active.filter(a=>type(a)===1);
        this.bulk=active.filter(a=>type(a)===2);
        this.articleMap=new Map(inventoryArticles.map(a=>[a.id,a]));
        this.movements=movements.filter(m=>m.actionId===1&&ids.has(m.articleId)).sort((a,b)=>new Date(b.movementDate).getTime()-new Date(a.movementDate).getTime());
        this.loading=false;this.hasLoaded=true;this.cdr.markForCheck();
      },error:err=>{
        this.loading=false;this.hasLoaded=true;
        this.error=String(err?.error?.error??'No se pudieron cargar las entradas. Los datos anteriores pueden estar desactualizados.');
        this.snackbar.open(this.error,'Cerrar',{duration:5000});this.cdr.markForCheck();
      }
    });
  }
  articleName(id:number):string{return this.articleMap.get(id)?.name||`Artículo #${id}`;}
  articleCode(id:number):string{return this.articleMap.get(id)?.code||'—';}
  newArticle():void{this.editArticle(null);}
  editArticle(id:number|null):void{
    const ref=this.dialog.open(ArticleFormComponent,{width:'1080px',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 24px)',disableClose:true,data:{id}});
    ref.afterClosed().subscribe(ok=>{if(ok)this.loadRealData();});
  }
  newEntry():void{
    const ref=this.dialog.open(MovementForm,{width:'min(600px,calc(100vw - 24px))',data:{actionId:1}});
    ref.afterClosed().subscribe(ok=>{if(ok)this.loadRealData();});
  }
  showArticle(id:number):void{this.dialog.open(ArticleDetailDialogComponent,{data:{id},width:'min(780px,calc(100vw - 24px))'});}
  showMovement(m:Movement):void{
    this.dialog.open(MovementDetailDialogComponent,{data:{movement:m,articleName:this.articleName(m.articleId),articleCode:this.articleCode(m.articleId)},width:'min(650px,calc(100vw - 24px))'});
  }
  deleteArticle(a:Article,event:Event):void{
    event.stopPropagation();
    if(!confirm(`¿Dar de baja el artículo "${a.name}"? Solo es posible con stock 0 y sin asignaciones pendientes.`))return;
    this.articles.deleteArticle(a.id).subscribe({
      next:()=>{this.snackbar.open('Artículo dado de baja.','Cerrar',{duration:3200});this.loadRealData();},
      error:err=>this.snackbar.open(String(err?.error?.error??'No se puede dar de baja el artículo.'),'Cerrar',{duration:5500})
    });
  }
}
