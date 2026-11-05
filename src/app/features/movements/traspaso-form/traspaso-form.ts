import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ArticleService } from '../../../core/services/articles';
import { MovementService } from '../../../core/services/movement';
import { Article } from '../../../core/models/article.model';

@Component({
  selector: 'app-traspaso-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, 
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './traspaso-form.html',
  styleUrls: ['./traspaso-form.scss']
})
export class TraspasoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private articleService = inject(ArticleService);
  private movementService = inject(MovementService);
  private snackBar = inject(MatSnackBar);
  public dialogRef = inject(MatDialogRef<TraspasoFormComponent>);

  traspasoForm: FormGroup;
  articles: Article[] = [];
  selectedArticleStock: number = 0;
  selectedPhotoPath: string | null = null; // Para la evidencia

  constructor() {
    this.traspasoForm = this.fb.group({
      articleId: [null, Validators.required],
      retireType: ['Parcial', Validators.required],
      amount: [{value: '', disabled: false}, [Validators.required, Validators.min(0.01)]],
      recipient: [''], // NUEVO: Según modelo C#
      observation: ['', Validators.required],
      companyId: [1]
    });
  }

  ngOnInit() {
    this.loadArticles();
    this.setupLogic();
  }

  loadArticles() {
    this.articleService.getArticles().subscribe({
      next: (data) => this.articles = data.filter(a => a.isActive && a.stock > 0),
      error: () => this.snackBar.open('Error al cargar artículos.', 'Cerrar', {duration: 3000})
    });
  }

  setupLogic() {
    this.traspasoForm.get('articleId')?.valueChanges.subscribe(id => {
      const article = this.articles.find(a => a.id === id);
      this.selectedArticleStock = article ? article.stock : 0;
      this.enforceStockRules();
    });

    this.traspasoForm.get('retireType')?.valueChanges.subscribe(type => {
      const amountCtrl = this.traspasoForm.get('amount');
      if (type === 'Total') {
        amountCtrl?.setValue(this.selectedArticleStock);
        amountCtrl?.disable();
      } else {
        amountCtrl?.setValue('');
        amountCtrl?.enable();
      }
      this.enforceStockRules();
    });

    this.traspasoForm.get('amount')?.valueChanges.subscribe(val => this.enforceStockRules());
  }

  enforceStockRules() {
    const type = this.traspasoForm.get('retireType')?.value;
    const amountCtrl = this.traspasoForm.get('amount');
    
    if (type === 'Parcial' && amountCtrl?.value > this.selectedArticleStock) {
      amountCtrl?.setErrors({ maxStock: true });
    }
  }

  onPhotoSelected(event: any) {
    // Simulación de carga de foto. En web, debes usar FormData para subir al backend real.
    const file = event.target.files[0];
    if (file) {
      this.selectedPhotoPath = file.name;
    }
  }

  onSubmit() {
    if (this.traspasoForm.invalid) return;

    const formValues = this.traspasoForm.getRawValue();
    const type = formValues.retireType === 'Total' ? 'BAJA TOTAL' : 'TRASPASO / RETIRO PARCIAL';
    const finalObservation = `[${type}] ${formValues.observation}`;

    // Payload actualizado con los campos de tu modelo C#
    const payload = {
      articleId: formValues.articleId,
      actionId: 3, 
      amount: formValues.amount,
      recipient: formValues.recipient, // Enviamos el destino
      observation: finalObservation,
      movementDate: new Date().toISOString(),
      companyId: formValues.companyId,
      photoPath: this.selectedPhotoPath || undefined // Enviamos la ruta si hay
    };

    this.movementService.createMovement(payload).subscribe({
      next: () => {
        this.snackBar.open('Traspaso registrado con éxito', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => this.snackBar.open('Error al registrar traspaso', 'Cerrar', { duration: 3000 })
    });
  }
}