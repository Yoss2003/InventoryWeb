import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ArticleService } from '../../../core/services/articles';
import { MovementService } from '../../../core/services/movement';
import { Article } from '../../../core/models/article.model';

@Component({
  selector: 'app-movement-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatInputModule, MatButtonModule, MatSelectModule, MatDialogModule],
  templateUrl: './movement-form.html'
})
export class MovementForm implements OnInit {
  private fb = inject(FormBuilder);
  private articleService = inject(ArticleService);
  private movementService = inject(MovementService);
  private snackBar = inject(MatSnackBar);
  
  public dialogRef = inject(MatDialogRef<MovementForm>);
  public data = inject(MAT_DIALOG_DATA); 

  movementForm: FormGroup;
  articles: Article[] = [];
  titulo: string = '';

  constructor() {
    this.movementForm = this.fb.group({
      articleId: [null, Validators.required],
      actionId: [this.data.actionId],
      amount: [1, [Validators.required, Validators.min(0.01)]],
      observation: [''],
      companyId: [1]
    });
    
    this.titulo = this.data.actionId === 1 ? 'Registrar Nueva Entrada' : 'Registrar Nueva Salida';
  }

  ngOnInit() {
    this.articleService.getArticles().subscribe({
      next: (data: Article[]) => this.articles = data,
      error: () => this.snackBar.open('Error cargando artículos', 'Cerrar', { duration: 3000 })
    });
  }

  onSubmit() {
    if (this.movementForm.invalid) return;

    const payload = {
      ...this.movementForm.value,
      movementDate: new Date().toISOString()
    };

    this.movementService.createMovement(payload).subscribe({
      next: () => {
        this.snackBar.open('Movimiento registrado', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => this.snackBar.open('Error al registrar', 'Cerrar', { duration: 3000 })
    });
  }
}