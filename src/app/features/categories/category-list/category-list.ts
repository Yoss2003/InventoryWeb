import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox'; // NUEVO
import { FormsModule } from '@angular/forms'; // NUEVO
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { CategoryService } from '../../../features/categories/services/category';
import { Category } from '../../../core/models/category.model';
import { CategoryParentFormComponent } from '../category-parent-form/category-parent-form';
import { CategoryChildFormComponent } from '../category-child-form/category-child-form';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    MatTableModule, MatCardModule, MatButtonModule, MatIconModule, 
    MatInputModule, MatCheckboxModule, FormsModule, CommonModule
  ],
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss',
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class CategoryListComponent implements OnInit {
  private categoryService = inject(CategoryService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  
  columnsToDisplay: string[] = ['expand', 'name', 'description', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<Category>();
  expandedElement: Category | null = null;

  // Controla la visibilidad de los inactivos
  mostrarInactivos: boolean = false;
  private rawData: Category[] = [];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.categoryService.getCategories().subscribe({
      next: (data: Category[]) => {
        this.rawData = data;
        this.processData();
      },
      error: (err: any) => console.error('Error cargando categorías', err)
    });
  }

  processData() {
    // 1. Separar Padres e Hijas
    let padres = this.rawData.filter(c => !c.parentCategoryId);
    let hijas = this.rawData.filter(c => c.parentCategoryId);

    // 2. Filtrar por estado si el Checkbox está apagado
    if (!this.mostrarInactivos) {
      padres = padres.filter(p => p.isActive);
      hijas = hijas.filter(h => h.isActive);
    }

    // 3. Anidar hijas y ordenar
    padres.forEach(padre => {
      let subcats = hijas.filter(h => h.parentCategoryId === padre.id);
      // Ordenar hijas: Activas primero, Inactivas al final
      subcats.sort((a, b) => (a.isActive === b.isActive) ? 0 : a.isActive ? -1 : 1);
      padre.subcategorias = subcats;
    });

    // Ordenar padres: Activos primero, Inactivos al final
    padres.sort((a, b) => (a.isActive === b.isActive) ? 0 : a.isActive ? -1 : 1);

    this.dataSource.data = padres;
    this.cdr.detectChanges();
  }

  toggleInactivos() {
    this.processData(); // Reprocesa la data local sin volver a llamar a la BD
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  nuevaCategoriaPadre(categoriaEdit?: Category) {
    const dialogRef = this.dialog.open(CategoryParentFormComponent, {
      width: '450px',
      data: categoriaEdit || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  nuevaCategoriaHija(categoriaEdit?: Category) {
    // Le pasamos solo los padres activos para el Select
    const padresActivos = this.dataSource.data.filter(p => p.isActive);
    
    const dialogRef = this.dialog.open(CategoryChildFormComponent, {
      width: 'min(1100px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      data: { 
        categoriaEdit: categoriaEdit || null,
        padres: padresActivos
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  eliminarCategoria(id: number, event: Event) {
    event.stopPropagation();
    alert('Llamar a servicio Delete para ID: ' + id);
  }
}