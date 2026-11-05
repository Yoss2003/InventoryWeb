import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Brand } from '../../../core/models/brand.model';
import { BrandService } from '../../../core/services/brands';

export interface BrandDialogData {
  categoryId: number;
  categoryName: string;
  inventoryId: number;
  selectedBrandId: number | null;
}

@Component({
  selector: 'app-brand-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
  templateUrl: './brand-dialog.html',
  styleUrls: ['./brand-dialog.scss']
})
export class BrandDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly brandsService = inject(BrandService);
  readonly dialogRef = inject(MatDialogRef<BrandDialogComponent, Brand | undefined>);
  readonly data: BrandDialogData = inject(MAT_DIALOG_DATA);

  brands: Brand[] = [];
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  saveError = '';
  query = '';
  selectedBrandId: number | null = this.data.selectedBrandId;

  readonly newBrandForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]]
  });

  ngOnInit(): void {
    this.loadBrands();
  }

  get filteredBrands(): Brand[] {
    const term = this.query.trim().toLocaleLowerCase('es');
    return term
      ? this.brands.filter(brand => brand.name.toLocaleLowerCase('es').includes(term))
      : this.brands;
  }

  loadBrands(refresh = false): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.brandsService.getBrands(refresh).subscribe({
      next: (brands) => {
        this.brands = (Array.isArray(brands) ? brands : [])
          .filter(b => b.isActive && Number(b.categoryId) === this.data.categoryId)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = error.status === 0
          ? 'No se pudo conectar con la API de marcas.'
          : `No se pudieron consultar las marcas (HTTP ${error.status}).`;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  chooseBrand(brand: Brand): void {
    this.selectedBrandId = brand.id;
    this.dialogRef.close(brand);
  }

  createBrand(): void {
    this.saveError = '';
    if (this.isSaving) return;
    if (this.newBrandForm.invalid) {
      this.newBrandForm.markAllAsTouched();
      return;
    }

    const name = this.newBrandForm.controls.name.value.trim();
    if (!name) {
      this.newBrandForm.controls.name.setErrors({ required: true });
      return;
    }
    if (this.brands.some(b => b.name.trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
      this.saveError = 'Esta marca ya está registrada en la categoría. Selecciónala en la lista.';
      return;
    }
    if (!(this.data.inventoryId > 0)) {
      this.saveError = 'La categoría no tiene un almacén válido. No se enviaron datos.';
      return;
    }

    this.isSaving = true;
    this.brandsService.createBrand({
      name,
      categoryId: this.data.categoryId,
      inventoryId: this.data.inventoryId
    }).subscribe({
      next: (created) => {
        this.isSaving = false;
        // El servidor respondió con la marca guardada; devolver el ID real.
        if (!created || !(Number(created.id) > 0)) {
          this.saveError = 'La API no devolvió el ID de la marca creada. Actualiza el listado.';
          this.loadBrands(true);
          this.cdr.markForCheck();
          return;
        }
        this.dialogRef.close(created);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        const detail = typeof error.error === 'string' ? error.error : error.error?.error || error.error?.message || error.error?.title;
        this.saveError = error.status === 0
          ? 'No se pudo conectar con la API. La marca no se ha confirmado.'
          : `No se pudo guardar la marca (HTTP ${error.status}).${detail ? ' ' + detail : ''}`;
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
  }
}
