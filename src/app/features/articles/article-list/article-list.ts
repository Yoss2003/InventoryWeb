import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { ArticleService } from '../../../core/services/articles';
import { CategoryService } from '../../categories/services/category';
import { BrandService } from '../../../core/services/brands';
import { Article } from '../../../core/models/article.model';
import { ArticleDetailDialogComponent } from '../article-detail-dialog/article-detail-dialog';
import { ArticleFormComponent } from '../article-form/article-form';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ArticleRow extends Article { categoryName: string; brandName: string; }
@Component({selector:'app-article-list',standalone:true,
  imports:[CommonModule,FormsModule,MatIconModule],
  templateUrl:'./article-list.html',styleUrl:'./article-list.scss'})
export class ArticleListComponent implements OnInit {
  private readonly articles=inject(ArticleService);
  private readonly categories=inject(CategoryService);
  private readonly brands=inject(BrandService);
  private readonly dialog=inject(MatDialog);
  private readonly cdr=inject(ChangeDetectorRef);
  private readonly snack=inject(MatSnackBar);
  dataSource:ArticleRow[]=[];
  search=''; showInactive=false; loading=true; error='';
  get visible():ArticleRow[]{
    const q=this.search.trim().toLocaleLowerCase('es');
    return this.dataSource.filter(a=>(this.showInactive||a.isActive)&&
      (!q||[a.code,a.name,a.model,a.categoryName,a.brandName,a.barcode??''].some(s=>String(s).toLocaleLowerCase('es').includes(q))));
  }
  ngOnInit():void{this.load();}
  load():void{
    this.loading=true;
    forkJoin({articles:this.articles.getArticles(),categories:this.categories.getCategories(),brands:this.brands.getBrands()}).subscribe({
      next:({articles,categories,brands})=>{
        const cm=new Map(categories.map(c=>[c.id,c.name]));
        const bm=new Map(brands.map(b=>[b.id,b.name]));
        this.dataSource=articles.map(a=>({...a,categoryName:cm.get(a.categoryId)||`#${a.categoryId}`,brandName:bm.get(Number(a.brandId))||'—'}));
        this.loading=false;this.error='';this.cdr.markForCheck();
      },error:err=>{this.loading=false;this.error=String(err?.error?.error??'No se pudo cargar el catálogo.');this.cdr.markForCheck();}
    });
  }
  showDetail(row:ArticleRow):void{
    const ref=this.dialog.open(ArticleDetailDialogComponent,{data:{id:row.id},width:'min(780px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 24px)'});
    ref.afterClosed().subscribe(changed=>{if(changed)this.load();});
  }
  create(): void { this.openEditor(null); }
  edit(row: ArticleRow, event: Event): void { event.stopPropagation(); if (row.isActive) this.openEditor(row.id); }
  private openEditor(id: number | null): void {
    const dialogRef = this.dialog.open(ArticleFormComponent, {
      data: { id }, width: 'min(1080px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 24px)', disableClose: true
    });
    dialogRef.afterClosed().subscribe(changed => {if (changed) this.load();});
  }
  delete(row: ArticleRow, event: Event): void {
    event.stopPropagation();
    if (!row.isActive || !confirm(`¿Desactivar el artículo "${row.name}"? Se conservará su historial.`)) return;
    this.articles.deleteArticle(row.id).subscribe({
      next: () => {this.snack.open('Artículo desactivado.', 'Cerrar', {duration: 3000}); this.load();},
      error: err => this.snack.open(String(err?.error?.error || 'No se pudo desactivar el artículo. Verifica el stock y sus asignaciones.'), 'Cerrar', {duration: 6000})
    });
  }

}
