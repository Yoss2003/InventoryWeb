import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { ArticleService } from '../../../core/services/articles';
import { Article } from '../../../core/models/article.model';
import { ArticleFormComponent } from '../../articles/article-form/article-form';

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatTabsModule, MatIconModule, MatButtonModule],
  templateUrl: './entradas.html',
  styleUrls: ['./entradas.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({height: '0px', minHeight: '0', display: 'none'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class EntradasComponent implements OnInit {
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private articleService = inject(ArticleService);
  private snackBar = inject(MatSnackBar);

  columnsToDisplay = ['photo', 'name', 'code', 'stock', 'actions'];
  expandedElement: any | null;

  articlesStandard: any[] = [];
  articlesBulk: any[] = [];
  articlesSerialized: any[] = [];

  ngOnInit() {
    this.loadRealData();
  }

  loadRealData() {
    this.articleService.getArticles().subscribe({
      next: (data: Article[]) => {
        // En tu C# TrackingMode es un Enum (0=Standard, 1=Serialized, 2=Bulk)
        const activas = data.filter(a => a.isActive);
        
        this.articlesStandard = activas.filter(a => a.trackingMode === "0" || (a as any).trackingMode === 'Standard').map(a => this.mapArticle(a, false));
        this.articlesBulk = activas.filter(a => a.trackingMode === "2" || (a as any).trackingMode === 'Bulk').map(a => this.mapArticle(a, false));
        this.articlesSerialized = activas.filter(a => a.trackingMode === "1" || (a as any).trackingMode === 'Serialized').map(a => this.mapArticle(a, true));
        
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error al conectar con la base de datos.', 'Cerrar', { duration: 3000 })
    });
  }

  mapArticle(a: any, isSerialized: boolean) {
    return {
      id: a.id,
      name: a.name,
      code: a.code || a.barcode || 'N/A',
      stock: a.stock,
      unit: a.measurementUnit || 'Unidad',
      acqPrice: a.acquisitionPrice || 0,
      salePrice: a.salePrice || 0,
      model: a.model || 'N/A',
      presentation: a.presentation || 'N/A',
      isSerialized: isSerialized,
      // Mapeamos el arreglo "details" de C# (ArticleDetails)
      series: a.details || a.articleDetails || [] 
    };
  }

  nuevoArticulo() {
    this.abrirModalEdicion(null);
  }

  editarArticulo(element: any, event: Event) {
    event.stopPropagation();
    // En una app real, buscarías el artículo completo por ID antes de abrir.
    // Aquí pasamos el ID para que el modal sepa que es una edición.
    this.abrirModalEdicion(element.id);
  }

  abrirModalEdicion(articleId: number | null) {
    const dialogRef = this.dialog.open(ArticleFormComponent, {
      width: '1080px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      disableClose: true,
      data: { id: articleId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadRealData();
    });
  }

  eliminarArticulo(element: any, event: Event) {
    event.stopPropagation();
    if (confirm(`¿Estás seguro de eliminar el artículo "${element.name}"?`)) {
      // AQUÍ IRÍA: this.articleService.deleteArticle(element.id).subscribe(...)
      this.snackBar.open('Artículo eliminado (Simulación)', 'Cerrar', { duration: 3000 });
      this.loadRealData(); // Refrescar tabla
    }
  }
}