import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryService } from '../services/category';
import { Category } from '../../../core/models/category.model';

@Component({
    selector: 'app-category-parent-form',
    standalone: true,
    imports: [ReactiveFormsModule, MatInputModule, MatButtonModule, MatDialogModule],
    template: `
    <h2 mat-dialog-title>{{ isEdit ? 'EDITAR CATEGORÍA PADRE' : 'NUEVA CATEGORÍA PADRE' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="parentForm" style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">
        <mat-form-field appearance="outline">
          <mat-label>Nombre del Grupo (Padre)</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Descripción (Opcional)</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>CANCELAR</button>
      <button mat-raised-button color="primary" [disabled]="parentForm.invalid" (click)="onSubmit()">
        {{ isEdit ? 'ACTUALIZAR' : 'GUARDAR' }}
      </button>
    </mat-dialog-actions>
  `
})
export class CategoryParentFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private categoryService = inject(CategoryService);
    private snackBar = inject(MatSnackBar);
    public dialogRef = inject(MatDialogRef<CategoryParentFormComponent>);
    public data: Category = inject(MAT_DIALOG_DATA); // Recibe data si es edición

    isEdit = false;
    parentForm: FormGroup = this.fb.group({
        id: [0],
        name: ['', Validators.required],
        description: [''],
        parentCategoryId: [null],
        isActive: [true],
        companyId: [1]
    });

    ngOnInit() {
        if (this.data) {
            this.isEdit = true;
            this.parentForm.patchValue(this.data);
        }
    }

    onSubmit() {
        if (this.parentForm.invalid) return;

        // Aquí iría tu lógica de HTTP POST o PUT dependiendo de isEdit
        this.categoryService.createCategory(this.parentForm.value).subscribe({
            next: () => {
                this.snackBar.open(`Categoría ${this.isEdit ? 'actualizada' : 'creada'} con éxito`, 'Cerrar', { duration: 3000 });
                this.dialogRef.close(true);
            },
            error: () => this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 })
        });
    }
}