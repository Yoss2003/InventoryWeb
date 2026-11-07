import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ArticleService } from '../../../core/services/articles';
import { MovementService } from '../../../core/services/movement';
import { Article } from '../../../core/models/article.model';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

@Component({
  selector: 'app-movement-form', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSelectModule, MatFormFieldModule, LoadingIndicatorComponent],
  templateUrl: './movement-form.html', styleUrl: './movement-form.scss'
})
export class MovementForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly articlesApi = inject(ArticleService);
  private readonly movementsApi = inject(MovementService);
  private readonly snack = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly dialogRef = inject(MatDialogRef<MovementForm>);
  readonly data: { actionId: number } = inject(MAT_DIALOG_DATA);
  articles: Article[] = [];
  loading = true;
  saving = false;
  error = '';
  readonly form = this.fb.group({
    articleId: [null as number | null, Validators.required],
    amount: [1, [Validators.required, Validators.min(0.01)]],
    observation: ['', Validators.maxLength(1000)]
  });
  get selected(): Article | undefined {return this.articles.find(a => a.id === Number(this.form.controls.articleId.value));}
  get canSave(): boolean {
    const quantity = Number(this.form.controls.amount.value);
    return !this.saving && !this.loading && this.form.valid && quantity > 0 &&
      (this.data.actionId !== 2 || quantity <= Number(this.selected?.stock ?? 0)) &&
      (this.selected?.tracking !== 1 || Number.isInteger(quantity));
  }
  ngOnInit(): void {
    this.articlesApi.getArticles().subscribe({
      next: values => {this.articles = values.filter(a => a.isActive); this.loading = false; this.cdr.markForCheck();},
      error: () => {this.error = 'No se pudo consultar el almacén.'; this.loading = false; this.cdr.markForCheck();}
    });
  }
  onSubmit(): void {
    if (!this.canSave || !this.selected) return;
    this.saving = true; this.error = '';this.cdr.markForCheck();
    const v = this.form.getRawValue();
    this.movementsApi.createMovement({
      articleId: this.selected.id, actionId: this.data.actionId,
      amount: Number(v.amount), observation: String(v.observation ?? ''),
      movementDate: new Date().toISOString(), companyId: 0
    }).subscribe({
      next: () => {
        this.saving = false;
        this.snack.open('Movimiento registrado. Stock actualizado.', 'Cerrar', {duration: 3000});
        this.dialogRef.close(true);
      },
      error: e => {
        this.saving = false;
        this.error = String(e?.error?.error ?? 'No se pudo guardar el movimiento.');
        this.cdr.markForCheck();
      }
    });
  }
}
