import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
  readonly dialogRef = inject(MatDialogRef<BrandDialogComponent, boolean>);
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
    if (this.isSaving || !brand.isActive) return;
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
    if (!name) {
      this.brandForm.controls.name.setErrors({ required: true });
      return;
    }

    const editingId = this.editingBrand?.id;
    if (this.brands.some(brand =>
      brand.id !== editingId && this.normalize(brand.name) === this.normalize(name)
    )) {
      this.saveError = 'Ya existe una marca con ese nombre en esta categoría.';
      return;
    }

    if (!this.editingBrand && !(Number(this.data.inventoryId) > 0)) {
      this.saveError = 'No se encontró el inventario asociado a esta categoría.';
      return;
    }

    if (this.editingBrand && this.editingBrand.name.trim() === name) {
      this.cancelEdit();
      return;
    }

    this.isSaving = true;
    const request$: Observable<Brand | void> = this.editingBrand
      ? this.brandsService.updateBrand(this.editingBrand, name)
      : this.brandsService.createBrand({
          name,
          categoryId: this.data.categoryId,
          inventoryId: this.data.inventoryId
        });

    request$.subscribe({
      next: saved => {
        const previous = this.editingBrand;
        this.isSaving = false;
        if (!previous && (!saved || typeof saved !== 'object' || !('id' in saved) || Number(saved.id) <= 0)) {
          this.saveError = 'La API no devolvió la marca creada. Actualiza la tabla antes de reintentar.';
          this.cdr.markForCheck();
          return;
        }

        if (previous) {
          this.brands = this.brands.map(brand =>
            brand.id === previous.id ? { ...brand, name } : brand
          );
        } else {
          this.brands = [...this.brands, saved as Brand];
        }
        this.brands = [...this.brands].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.hasChanges = true;
        this.editingBrand = null;
        this.brandForm.reset({ name: '' });
        this.successMessage = previous ? 'Marca actualizada correctamente.' : 'Marca registrada correctamente.';
        // No recargar toda la tabla: evita parpadeos.
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.saveError = this.formatHttpError(error, 'guardar');
        this.cdr.markForCheck();
      }
    });
  }

  deleteBrand(brand: Brand): void {
    if (this.isSaving || !brand.isActive || this.editingBrand?.id === brand.id) return;
    if (!window.confirm(`¿Deseas eliminar la marca "${brand.name}"?`)) return;

    this.isSaving = true;
    this.saveError = '';
    this.successMessage = '';
    this.brandsService.deleteBrand(brand.id).subscribe({
      next: () => {
        // La API debe realizar BAJA LÓGICA: IsActive = false.
        this.brands = this.brands.map(item =>
          item.id === brand.id ? { ...item, isActive: false } : item
        );
        this.isSaving = false;
        this.hasChanges = true;
        this.successMessage = 'Marca desactivada correctamente.';
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.saveError = this.formatHttpError(error, 'eliminar');
        this.cdr.markForCheck();
      }
    });
  }

  close(): void {
    if (!this.isSaving) this.dialogRef.close(this.hasChanges);
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
