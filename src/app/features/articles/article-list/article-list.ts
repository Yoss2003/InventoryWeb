import { UiEmptyStateComponent } from '../../../shared/ui/v2/ui-empty-state.component';
import { UiStatusComponent } from '../../../shared/ui/v2/ui-status.component';
import { UiTableActionDirective } from '../../../shared/ui/v2/ui-table-action.directive';
import { UiButtonDirective } from '../../../shared/ui/v2/ui-button.directive';
import { UiPageHeadingComponent } from '../../../shared/ui/v2/ui-page-heading.component';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, filter, take } from 'rxjs';
import { ArticleService } from '../../../core/services/articles';
import { InventoryContextService } from '../../../core/services/inventory-context';
import { CategoryService } from '../../categories/services/category';
import { BrandService } from '../../../core/services/brands';
import { Article } from '../../../core/models/article.model';
import { ArticleDetailDialogComponent } from '../article-detail-dialog/article-detail-dialog';
import { ArticleFormComponent } from '../article-form/article-form';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

interface ArticleRow extends Article { categoryName: string; brandName: string; }
import { UiSearchComponent } from '../../../shared/ui/ui-search.component';

@Component({selector:'app-article-list',standalone:true,
  imports:[UiEmptyStateComponent, UiStatusComponent, UiTableActionDirective, UiButtonDirective, UiPageHeadingComponent, CommonModule,FormsModule,MatIconModule,LoadingIndicatorComponent,UiSearchComponent],
  templateUrl:'./article-list.html',styleUrl:'./article-list.scss'})
export class ArticleListComponent implements OnInit {
  private readonly articles=inject(ArticleService);
  private readonly inventoryContext=inject(InventoryContextService);
  private readonly categories=inject(CategoryService);
  private readonly brands=inject(BrandService);
  private readonly dialog=inject(MatDialog);
  private readonly cdr=inject(ChangeDetectorRef);
  private readonly snack=inject(MatSnackBar);
  dataSource:ArticleRow[]=[];
  search='';showInactive=false;loading=false;hasLoaded=false;error='';
  get visible():ArticleRow[]{
    const q=this.search.trim().toLocaleLowerCase('es');
    return this.dataSource.filter(a=>(this.showInactive||a.isActive)&&
      (!q||[a.code,a.name,a.model,a.categoryName,a.brandName,a.barcode??''].some(s=>String(s).toLocaleLowerCase('es').includes(q))));
  }
  ngOnInit():void{this.inventoryContext.activeInventoryId$.pipe(filter(id=>id!==null),take(1)).subscribe(()=>this.load());}
  load():void{
    if(this.loading)return;
    this.loading=true;
    this.error='';
    this.cdr.markForCheck();
    forkJoin({articles:this.articles.getArticles(),categories:this.categories.getCategories(),brands:this.brands.getBrands()}).subscribe({
      next:({articles,categories,brands})=>{
        const cm=new Map(categories.map(c=>[c.id,c.name]));
        const bm=new Map(brands.map(b=>[b.id,b.name]));
        this.dataSource=articles.filter(a=>a.inventoryId===this.inventoryContext.activeInventoryId).map(a=>({...a,categoryName:cm.get(a.categoryId)||`#${a.categoryId}`,brandName:bm.get(Number(a.brandId))||'—'}));
        this.loading=false;this.hasLoaded=true;this.cdr.markForCheck();
      },error:err=>{this.loading=false;this.hasLoaded=true;this.error=String(err?.error?.error??'No se pudo cargar el catálogo. Los datos anteriores pueden estar desactualizados.');this.cdr.markForCheck();}
    });
  }
  showDetail(row:ArticleRow):void{
    const ref=this.dialog.open(ArticleDetailDialogComponent,{data:{id:row.id},width:'min(780px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 24px)'});
    ref.afterClosed().subscribe(changed=>{if(changed)this.load();});
  }
  create():void {this.openEditor(null);}
  edit(row:ArticleRow,event:Event):void {event.stopPropagation();if(row.isActive)this.openEditor(row.id);}
  private openEditor(id:number|null):void {
    const dialogRef=this.dialog.open(ArticleFormComponent,{enterAnimationDuration:220,exitAnimationDuration:180,data:{id},width:'min(1080px, calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 24px)',disableClose:true});
    dialogRef.afterClosed().subscribe(changed=>{if(changed)this.load();});
  }
  delete(row:ArticleRow,event:Event):void {
    event.stopPropagation();
    if(!row.isActive||!confirm(`¿Desactivar el artículo "${row.name}"? Se conservará su historial.`))return;
    this.articles.deleteArticle(row.id).subscribe({
      next:()=>{this.snack.open('Artículo desactivado.','Cerrar',{duration:3000});this.load();},
      error:err=>this.snack.open(String(err?.error?.error||'No se pudo desactivar el artículo. Verifica el stock y sus asignaciones.'),'Cerrar',{duration:6000})
    });
  }
}
