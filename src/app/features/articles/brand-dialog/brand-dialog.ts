import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToastService } from '../../../shared/toast/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirm-dialog/confirmation-dialog.service';
import { CatalogSimilarDialogComponent, CatalogSimilarChoice } from '../../../shared/catalog-similar-dialog/catalog-similar-dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Brand } from '../../../core/models/brand.model';
import { BrandService } from '../../../core/services/brands';

export interface BrandDialogData {
  categoryId: number;
  categoryName: string;
  inventoryId: number;
  selectedBrandId?: number | null;
}

@Component({
  selector: 'app-brand-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './brand-dialog.html',
  styleUrls: ['./brand-dialog.scss']
})
export class BrandDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly brandsService = inject(BrandService);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(MatDialog);
  private readonly confirms = inject(ConfirmationDialogService);
  private readonly platformId = inject(PLATFORM_ID);
  get canManage(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try { return [1,2].includes(Number(JSON.parse(localStorage.getItem('userSession') || '{}').roleId)); }
    catch { return false; }
  }
  readonly dialogRef = inject(MatDialogRef<BrandDialogComponent, boolean | { brandId: number }>);
  readonly data: BrandDialogData = inject(MAT_DIALOG_DATA);

  brands: Brand[] = [];
  isLoading = true;
  isRefreshing = false;
  isSaving = false;
  private hasLoadedBrands = false;
  errorMessage = '';
  saveError = '';
  successMessage = '';
  query = '';
  showInactive = false;
  editingBrand: Brand | null = null;
  hasChanges = false;
  lastSavedBrandId: number | null = null;

  readonly brandForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]]
  });

  ngOnInit(): void {
    // La clase controla el contenedor EXTERIOR de Angular Material.
    this.dialogRef.addPanelClass('inventory-brand-dialog-pane');
    this.dialogRef.updateSize(
      'min(520px, calc(100vw - 24px))',
      'min(700px, calc(100dvh - 24px))'
    );
    this.loadBrands();
  }

  get inactiveCount(): number {
    return this.brands.filter(brand => !brand.isActive).length;
  }

  get visibleBrandCount(): number {
    return this.brands.filter(brand => this.showInactive || brand.isActive).length;
  }

  get filteredBrands(): Brand[] {
    const term = this.normalize(this.query);
    return this.brands.filter(brand =>
      (this.showInactive || brand.isActive) &&
      (!term || this.normalize(brand.name).includes(term))
    );
  }

  trackByBrandId(_index: number, brand: Brand): number {
    return brand.id;
  }

  onShowInactiveChange(event: Event): void {
    this.showInactive = (event.target as HTMLInputElement).checked;
  }

  loadBrands(refresh = false): void {
    if (this.isRefreshing || (this.isLoading && refresh && !this.hasLoadedBrands)) return;

    // En refrescos posteriores no retiramos la tabla del DOM.
    this.isLoading = !this.hasLoadedBrands;
    this.isRefreshing = this.hasLoadedBrands;
    this.errorMessage = '';

    this.brandsService.getBrands(refresh).subscribe({
      next: brands => {
        // IMPORTANTE: conservar también las inactivas, solo ocultarlas por defecto.
        this.brands = (Array.isArray(brands) ? brands : [])
          .filter(brand => Number(brand.categoryId) === Number(this.data.categoryId))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.isLoading = false;
        this.isRefreshing = false;
        this.hasLoadedBrands = true;
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = error.status === 0
          ? 'No se pudo conectar con la API de marcas.'
          : `No se pudieron consultar las marcas (HTTP ${error.status}).`;
        this.isLoading = false;
        this.isRefreshing = false;
        this.hasLoadedBrands = true;
        this.cdr.markForCheck();
      }
    });
  }

  startEdit(brand: Brand): void {
    if (!this.canManage || this.isSaving || !brand.isActive) return;
    this.editingBrand = brand;
    this.brandForm.reset({ name: brand.name });
    this.saveError = '';
    this.successMessage = '';
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    if (this.isSaving) return;
    this.editingBrand = null;
    this.brandForm.reset({ name: '' });
    this.saveError = '';
    this.successMessage = '';
    this.cdr.markForCheck();
  }

  saveBrand(): void {
    this.saveError = '';
    this.successMessage = '';
    if (this.isSaving) return;
    this.brandForm.markAllAsTouched();
    if (this.brandForm.invalid) return;
    const name = this.brandForm.controls.name.value.trim();
    if (!name) return;
    if (this.editingBrand && !this.canManage) { this.toast.warning('Solo un administrador puede editar marcas.'); return; }
    if (!this.editingBrand && !(Number(this.data.inventoryId) > 0)) {
      this.saveError = 'No se encontró el inventario de esta categoría.';
      return;
    }
    if (this.editingBrand?.name.trim() === name) { this.cancelEdit(); return; }
    this.persistBrand(name, false);
  }

  private persistBrand(name: string, allowSimilar: boolean): void {
    this.isSaving = true;
    const previous = this.editingBrand;
    const request$: Observable<Brand | void> = previous
      ? this.brandsService.updateBrand(previous, name)
      : this.brandsService.createBrand({ name, categoryId: this.data.categoryId, inventoryId: this.data.inventoryId }, allowSimilar);
    request$.subscribe({
      next: saved => {
        this.isSaving = false;
        if (!previous && (!saved || typeof saved !== 'object' || !('id' in saved) || Number(saved.id) <= 0)) {
          this.saveError = 'La API no devolvió una marca válida.';
          this.cdr.markForCheck(); return;
        }
        if (previous) this.brands = this.brands.map(item => item.id === previous.id ? { ...item, name } : item);
        else if (saved && !this.brands.some(item => item.id === saved.id)) this.brands = [...this.brands, saved];
        this.brands.sort((a,b) => a.name.localeCompare(b.name,'es'));
        this.hasChanges = true;
        if (!previous && saved) this.lastSavedBrandId = saved.id;
        this.editingBrand = null;
        this.brandForm.reset({ name: '' });
        const reused = !previous && Boolean(saved && saved.reused);
        this.successMessage = reused ? 'Se utilizó la marca existente.' : previous ? 'Marca actualizada.' : 'Marca registrada.';
        if (reused) this.toast.info(`Se reutilizó automáticamente la marca «${(saved as Brand).name}».`, 'Marca existente');
        else this.toast.success(this.successMessage);
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        if (!previous && error.status === 409 && error.error?.code === 'similar_name') {
          const matches = (error.error?.matches || []) as {id:number;name:string}[];
          this.toast.warning('Encontramos marcas parecidas. Elige una opción.', 'Posible duplicado');
          this.dialogs.open(CatalogSimilarDialogComponent, { data: {type:'marcas',enteredName:name,matches}, width:'min(500px,calc(100vw - 24px))' })
            .afterClosed().subscribe((choice: CatalogSimilarChoice | undefined) => {
              if (choice?.action === 'create') this.persistBrand(name, true);
              else if (choice?.action === 'reuse') {
                this.hasChanges = true;
                this.lastSavedBrandId = choice.id;
                this.brandForm.reset({name:''});
                this.toast.info('Se utilizará una marca ya registrada. Selecciónala en el ComboBox del artículo.','Marca existente');
                this.loadBrands(true);
              }
            });
        } else {
          this.saveError = this.formatHttpError(error, 'guardar');
          this.toast.error(this.saveError);
        }
        this.cdr.markForCheck();
      }
    });
  }

  deleteBrand(brand: Brand): void {
    if (!this.canManage || this.isSaving || !brand.isActive || this.editingBrand?.id === brand.id) return;
    this.confirms.confirm({
      title: 'Desactivar marca',
      message: `¿Desactivar «${brand.name}»? Se conservarán las referencias históricas.`,
      confirmLabel: 'Desactivar',
      tone: 'danger',
      icon: 'block'
    }).subscribe(confirmed => {
      if (!confirmed || !this.canManage || this.isSaving ||
          !brand.isActive || this.editingBrand?.id === brand.id) return;
      this.isSaving = true;
      this.saveError = '';
      this.successMessage = '';
      this.brandsService.deleteBrand(brand.id).subscribe({
        next: () => {
          this.brands = this.brands.map(item =>
            item.id === brand.id ? { ...item, isActive: false } : item
          );
          this.isSaving = false;
          this.hasChanges = true;
          this.successMessage = 'Marca desactivada correctamente.';
          this.toast.success(this.successMessage);
          this.cdr.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving = false;
          this.saveError = this.formatHttpError(error, 'eliminar');
          this.cdr.markForCheck();
        }
      });
    });
  }

  close(): void {
    if (!this.isSaving) this.dialogRef.close(this.lastSavedBrandId ? { brandId: this.lastSavedBrandId } : this.hasChanges);
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('es-PE');
  }

  private formatHttpError(error: HttpErrorResponse, verb: string): string {
    const detail = typeof error.error === 'string'
      ? error.error
      : error.error?.error || error.error?.message || error.error?.title;
    return error.status === 0
      ? `No se pudo conectar con la API para ${verb} la marca.`
      : `No se pudo ${verb} la marca (HTTP ${error.status}).${detail ? ' ' + detail : ''}`;
  }
}
