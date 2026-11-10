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
import { isUnitConversion, fixedUnitFactor, isMeasuredUnit, validPieces, validQuantity, quantityStep } from '../../../shared/inventory/inventory-units';

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
    conversionFactor: [null as number | null],
    observation: ['', Validators.maxLength(1000)]
  });
  get selected(): Article | undefined {
    return this.articles.find(a => a.id === Number(this.form.controls.articleId.value));
  }
  get isEntry(): boolean { return this.data.actionId === 1; }
  get purchaseUnit(): string {
    const article = this.selected;
    return this.isEntry
      ? String(article?.acquisitionUnit || article?.measurementUnit || '')
      : String(article?.saleUnit || article?.measurementUnit || '');
  }
  get saleUnit(): string {return String(this.selected?.saleUnit || this.selected?.measurementUnit || '');}
  get amountStep(): number {return this.isEntry ? quantityStep(this.purchaseUnit) : 0.01;}
  get needsConversion(): boolean {
    return this.isEntry && isUnitConversion(this.purchaseUnit, this.saleUnit);
  }
  get fixedFactor(): number | null {
    return this.needsConversion ? fixedUnitFactor(this.purchaseUnit) : null;
  }
  get movementFactor(): number {
    return this.fixedFactor ?? Number(this.form.controls.conversionFactor.value);
  }
  get enteredQuantityValid(): boolean {
    return !this.selected || validQuantity(this.form.controls.amount.value, this.purchaseUnit, true);
  }
  get enteredFactorValid(): boolean {
    return !this.needsConversion || validPieces(this.movementFactor, true);
  }
  get stockIncrement(): number {
    const amount = Number(this.form.controls.amount.value);
    const factor = this.needsConversion ? this.movementFactor : 1;
    return Number.isFinite(amount) && Number.isFinite(factor)
      ? Math.round(amount * factor * 100) / 100 : NaN;
  }
  get ruleError(): string {
    if (!this.isEntry || !this.selected) return '';
    // El API de movimientos ordinarios rechaza expresamente los artículos serializados.
    if (this.selected.tracking === 1) return 'Para artículos serializados registra cada serie con Gestión de series.';
    if (isMeasuredUnit(this.purchaseUnit) && this.purchaseUnit !== this.saleUnit) {
      return 'Esta medida física debe tener la misma unidad de compra y venta. Corrige el artículo.';
    }
    if (this.purchaseUnit !== this.saleUnit && !this.needsConversion) {
      return 'La combinación de unidades del artículo no permite calcular el stock.';
    }
    return '';
  }
  get canSave(): boolean {
    if (this.saving || this.loading || this.form.invalid || !this.selected) return false;
    const amount = this.form.controls.amount.value;
    if (!this.isEntry) {
      // Salidas intactas: conserva las reglas previas de este componente.
      const quantity = Number(amount);
      return quantity > 0 && quantity <= Number(this.selected.stock) &&
        (this.selected.tracking !== 1 || Number.isInteger(quantity));
    }
    if (this.ruleError) return false;
    const effectiveAmount = this.stockIncrement;
    if (!validQuantity(amount, this.purchaseUnit, true) ||
        !validQuantity(effectiveAmount, this.saleUnit, true)) return false;
    return !this.needsConversion || validPieces(this.movementFactor, true);
  }
  private syncSelectedArticle(): void {
    const article = this.selected;
    const factor = this.form.controls.conversionFactor;
    const existing = Number(article?.conversionFactor);
    factor.setValue(this.needsConversion && this.fixedFactor === null &&
      validPieces(existing, true) ? existing : null, {emitEvent:false});
    if (this.needsConversion && this.fixedFactor === null) {
      factor.setValidators([Validators.required, Validators.min(1), Validators.pattern(/^[1-9]\d*$/)]);
    } else factor.clearValidators();
    factor.updateValueAndValidity({emitEvent:false});
    this.form.controls.amount.setValue(1, {emitEvent:false});
    this.form.controls.amount.markAsUntouched();
  }
  ngOnInit(): void {
    this.form.controls.articleId.valueChanges.subscribe(() => this.syncSelectedArticle());
    this.articlesApi.getArticles().subscribe({
      next: values => {this.articles = values.filter(a => a.isActive); this.loading = false; this.cdr.markForCheck();},
      error: () => {this.error = 'No se pudo consultar el almacén.'; this.loading = false; this.cdr.markForCheck();}
    });
  }
  onSubmit(): void {
    if (!this.canSave || !this.selected) return;
    this.saving = true; this.error = '';this.cdr.markForCheck();
    const v = this.form.getRawValue();
    // WEBINVENTORY_UNIDADES_INGRESOS_2026_V1: API recibe la cantidad de STOCK, no el número de cajas/docenas.
    const stockAmount = this.isEntry ? this.stockIncrement : Number(v.amount);
    const originalQuantity = Number(v.amount);
    const originalUnit = this.purchaseUnit;
    const memo = String(v.observation ?? '').trim();
    const conversionTrace = this.isEntry && this.needsConversion
      ? 'Ingreso: ' + originalQuantity + ' ' + originalUnit +
        ' x ' + this.movementFactor + ' = ' + stockAmount + ' ' + this.saleUnit + '.'
      : '';
    this.movementsApi.createMovement({
      articleId: this.selected.id, actionId: this.data.actionId,
      amount: stockAmount,
      observation: this.isEntry && this.needsConversion
        ? [conversionTrace, memo].filter(Boolean).join(' ') : memo,
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

/* WEBINVENTORY_UNIDADES_INGRESOS_2026_V1: movementTs */
