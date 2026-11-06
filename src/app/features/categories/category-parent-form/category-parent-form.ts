import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryService } from '../services/category';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-category-parent-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './category-parent-form.html',
  styleUrl: './category-parent-form.scss'
})
export class CategoryParentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  readonly dialogRef = inject(MatDialogRef<CategoryParentFormComponent>);
  readonly data: Category | null = inject(MAT_DIALOG_DATA);

  isEdit = false;
  isSaving = false;
  saveError = '';
  private originalSnapshot = '';

  readonly parentForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['']
  });

  ngOnInit(): void {
    this.isEdit = !!this.data?.id;
    if (this.data) {
      this.parentForm.patchValue({
        name: this.data.name ?? '',
        description: this.data.description ?? ''
      });
    }
    this.originalSnapshot = this.formSnapshot();
  }

  private formSnapshot(): string {
    const value = this.parentForm.getRawValue();
    return JSON.stringify({
      name: String(value.name ?? '').trim(),
      description: String(value.description ?? '').trim()
    });
  }

  get hasChanges(): boolean {
    return !this.isEdit || this.formSnapshot() !== this.originalSnapshot;
  }

  get canSave(): boolean {
    return !this.isSaving && this.parentForm.valid &&
      !!String(this.parentForm.get('name')?.value ?? '').trim() && this.hasChanges;
  }

  onSubmit(): void {
    if (!this.canSave) return;
    this.isSaving = true;
    this.saveError = '';
    const value = this.parentForm.getRawValue();
    const name = String(value.name ?? '').trim();
    const description = String(value.description ?? '').trim();

    // La API obtiene CompanyId desde la empresa autenticada.
    // En la creación no enviamos Id: PostgreSQL debe generarlo automáticamente.
    const payload: Category = this.isEdit && this.data
      ? { ...this.data, name, description, parentCategoryId: null }
      : {
          id: 0, // Se omite del cuerpo POST más abajo.
          name,
          description,
          inventoryId: 0, // Hasta conectar el inventario seleccionado de la sesión.
          companyId: 0, // El servidor obtiene la empresa del token.
          parentCategoryId: null,
          isActive: true
        };

    // POST y PUT devuelven tipos distintos; nos suscribimos a cada rama por separado.
    const onSuccess = (): void => {
      this.isSaving = false;
      this.snackBar.open(
        `Categoría ${this.isEdit ? 'actualizada' : 'creada'} correctamente`,
        'Cerrar', { duration: 3000 }
      );
      this.dialogRef.close(true);
    };
    const onError = (error: { error?: { error?: string; message?: string } | string }): void => {
      this.isSaving = false;
      const body = error.error;
      this.saveError = typeof body === 'string'
        ? body
        : body?.error ?? body?.message ?? 'No se pudo guardar la categoría.';
    };

    if (this.isEdit) {
      this.categoryService.updateCategory(payload).subscribe({ next: onSuccess, error: onError });
    } else {
      this.categoryService.createCategory({
        name, description, inventoryId: payload.inventoryId,
        companyId: payload.companyId, parentCategoryId: null, isActive: true
      }).subscribe({ next: onSuccess, error: onError });
    }
  }
}
