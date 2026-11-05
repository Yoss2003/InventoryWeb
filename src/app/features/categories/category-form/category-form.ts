import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryService } from '../services/category';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatInputModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Nueva Categoría</h2>
    <mat-dialog-content>
      <form [formGroup]="categoryForm" style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">
        <mat-form-field appearance="outline">
          <mat-label>Nombre de la Categoría</mat-label>
          <input matInput formControlName="name" placeholder="Ej. Electrónicos" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descripción (Opcional)</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-raised-button color="primary" [disabled]="categoryForm.invalid" (click)="onSubmit()">
        Guardar
      </button>
    </mat-dialog-actions>
  `
})
export class CategoryFormComponent {
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private snackBar = inject(MatSnackBar);
  public dialogRef = inject(MatDialogRef<CategoryFormComponent>);

  categoryForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    isActive: [true],
    companyId: [1] // Valor por defecto de tu MVP
  });

  onSubmit() {
    if (this.categoryForm.invalid) return;

    this.categoryService.createCategory(this.categoryForm.value).subscribe({
      next: () => {
        this.snackBar.open('Categoría creada exitosamente', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true); // Retorna true para refrescar la tabla
      },
      error: () => this.snackBar.open('Error al crear categoría', 'Cerrar', { duration: 3000 })
    });
  }
}