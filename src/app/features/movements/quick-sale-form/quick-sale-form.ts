import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ArticleService } from '../../../core/services/articles';
import { Article } from '../../../core/models/article.model';
import { SalesService } from '../../../core/services/sales';

@Component({ selector: 'app-quick-sale-form', standalone: true, imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSelectModule, MatInputModule, MatFormFieldModule], templateUrl: './quick-sale-form.html', styleUrl: './quick-sale-form.scss' })
export class QuickSaleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly articlesApi = inject(ArticleService);
  private readonly salesApi = inject(SalesService);
  private readonly snackBar = inject(MatSnackBar);
  readonly dialogRef = inject(MatDialogRef<QuickSaleFormComponent>);
  readonly Number = Number; 
  articles: Article[] = [];
  step = 1;
  get isSerialized(): boolean {
    const a = this.chosen;
    return !!a && (Number(a.tracking) === 1 || /^(serialized|serializado|1)$/i.test(String(a.trackingMode ?? '')));
  }
  get availableSerials(): string[] {
    const a = this.chosen;
    return (a?.details ?? a?.articleDetails ?? []).filter(d => d.isActive !== false).map(d => d.serialNumber).filter(Boolean);
  }
  get canAdvanceArticle(): boolean {
    const amount = Number(this.form.controls.quantity.value);
    return !!this.chosen && amount > 0 && amount <= Number(this.chosen.stock) &&
      Number.isInteger(this.isSerialized ? amount : 1) && Number(this.form.controls.unitPrice.value) >= 0;
  }
  get canAdvanceCustomer(): boolean { return !!this.form.controls.customerName.value?.trim(); }
  goStep(next: number): void {
    if (this.submitting || next < 1 || next > 3) return;
    if (next > 1 && !this.canAdvanceArticle) return;
    if (next > 2 && !this.canAdvanceCustomer) return;
    this.step = next;
  }

  submitting = false;
  readonly paymentMethods = ['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Bim', 'Transferencia', 'Cuotas'];
  readonly form = this.fb.group({
    articleId: [null as number | null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    customerName: ['Público general'],
    paymentMethod: ['Efectivo', Validators.required],
    notes: ['']
  });
  get chosen(): Article | undefined { return this.articles.find(a => a.id === Number(this.form.controls.articleId.value)); }
  get total(): number { return Number(this.form.controls.quantity.value) * Number(this.form.controls.unitPrice.value); }
  get canSubmit(): boolean { return !this.submitting && this.form.valid && this.canAdvanceArticle && this.canAdvanceCustomer && !this.isSerialized; }
  ngOnInit(): void {
    this.articlesApi.getArticles().subscribe({ next: a => this.articles = a.filter(x => x.isActive && x.stock > 0), error: () => this.snackBar.open('No se pudieron cargar los artículos.', 'Cerrar', { duration: 4000 }) });
    this.form.controls.articleId.valueChanges.subscribe(id => {
      const a = this.articles.find(x => x.id === Number(id));
      this.form.controls.unitPrice.setValue(Number(a?.salePrice ?? 0));
    });
  }
  onSubmit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    const a = this.form.getRawValue();
    this.salesApi.quickSale({ articleId: Number(a.articleId), quantity: Number(a.quantity), unitPrice: Number(a.unitPrice), customerName: a.customerName || '', paymentMethod: a.paymentMethod || 'Efectivo', notes: a.notes || '', operationKey: crypto.randomUUID() }).subscribe({
      next: ({ saleId }) => { this.submitting = false; this.snackBar.open(`Venta #${saleId} registrada con stock actualizado.`, 'Cerrar', { duration: 4000 }); this.dialogRef.close(true); },
      error: err => { this.submitting = false; this.snackBar.open(String(err?.error?.error ?? 'No se pudo registrar la venta.'), 'Cerrar', { duration: 6000 }); }
    });
  }
}
