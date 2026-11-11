
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, timeout } from 'rxjs';

import { ArticleService } from '../../../core/services/articles';
import { Article } from '../../../core/models/article.model';
import {
  SerialUnitsService,
  SerialUnit
} from '../../../core/services/serial-units';
import { SalesService } from '../../../core/services/sales';
import {
  ExternalConsultasService,
  SunatRuc
} from '../../../core/services/external-consultas';
import {
  InventoryDialogMotionDirective
} from '../../../shared/ui/inv-dialog-motion.directive';

@Component({
  selector: 'app-quick-sale-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    InventoryDialogMotionDirective
  ],
  templateUrl: './quick-sale-form.html',
  styleUrl: './quick-sale-form.scss'
})
export class QuickSaleFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly articlesApi = inject(ArticleService);
  private readonly serialsApi = inject(SerialUnitsService);
  private readonly salesApi = inject(SalesService);
  private readonly sunatApi = inject(ExternalConsultasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly dialogRef = inject(MatDialogRef<QuickSaleFormComponent>);

  articles: Article[] = [];
  step = 1;
  submitting = false;

  availableSerials: SerialUnit[] = [];
  selectedSerialIds: number[] = [];
  serialError = '';

  // Consulta SUNAT
  rucQuery = '';
  loadingRuc = false;
  sunatResult: SunatRuc | null = null;
  sunatError = '';
  private rucRequest?: Subscription;

  readonly paymentMethods = [
    'Efectivo',
    'Tarjeta',
    'Yape',
    'Plin',
    'Bim',
    'Transferencia',
    'Cuotas'
  ];

  readonly form = this.fb.group({
    articleId: [null as number | null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    customerName: ['Público general'],
    paymentMethod: ['Efectivo', Validators.required],
    notes: ['']
  });

  get chosen(): Article | undefined {
    return this.articles.find(
      a => a.id === Number(this.form.controls.articleId.value)
    );
  }

  get isSerialized(): boolean {
    const a = this.chosen;

    return !!a && (
      Number(a.tracking) === 1 ||
      /^(serialized|serializado|1)$/i.test(String(a.trackingMode ?? ''))
    );
  }

  get canAdvanceArticle(): boolean {
    const amount = Number(this.form.controls.quantity.value);

    return !!this.chosen &&
      amount > 0 &&
      amount <= Number(this.chosen.stock) &&
      (
        !this.isSerialized ||
        (
          Number.isInteger(amount) &&
          this.selectedSerialIds.length === amount
        )
      ) &&
      Number(this.form.controls.unitPrice.value) >= 0;
  }

  get canAdvanceCustomer(): boolean {
    return !!this.form.controls.customerName.value?.trim();
  }

  get canSubmit(): boolean {
    return !this.submitting &&
      this.form.valid &&
      this.canAdvanceArticle &&
      this.canAdvanceCustomer;
  }

  get total(): number {
    return Number(this.form.controls.quantity.value) *
      Number(this.form.controls.unitPrice.value);
  }

  get trackingLabel(): string {
    const article = this.chosen;
    if (!article) return '—';
    if (this.isSerialized) return 'Serializado';

    const mode = Number(article.tracking);

    return mode === 2 ||
      /^(a granel|bulk|2)$/i.test(String(article.trackingMode ?? ''))
      ? 'A granel'
      : 'Estándar';
  }

  ngOnInit(): void {
    this.articlesApi.getArticles().subscribe({
      next: articles => {
        this.articles = articles.filter(
          x => x.isActive && x.stock > 0
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open(
          'No se pudieron cargar los artículos.',
          'Cerrar',
          { duration: 4000 }
        );
        this.cdr.markForCheck();
      }
    });

    this.form.controls.articleId.valueChanges.subscribe(id => {
      const article = this.articles.find(
        x => x.id === Number(id)
      );

      this.form.controls.unitPrice.setValue(
        Number(article?.salePrice ?? 0)
      );

      this.selectedSerialIds = [];
      this.availableSerials = [];
      this.serialError = '';

      if (
        article &&
        (
          Number(article.tracking) === 1 ||
          /^(serialized|serializado|1)$/i.test(
            String(article.trackingMode ?? '')
          )
        )
      ) {
        this.serialsApi.available(article.id).subscribe({
          next: rows => {
            if (
              Number(this.form.controls.articleId.value) === article.id
            ) {
              this.availableSerials = rows;
              this.cdr.markForCheck();
            }
          },
          error: () => {
            this.serialError =
              'No se pudieron cargar las unidades disponibles.';
            this.cdr.markForCheck();
          }
        });
      }
    });
  }

  // Navegación: la directiva anima la nueva altura.
  goStep(next: number): void {
    if (
      this.submitting ||
      next < 1 ||
      next > 3 ||
      next === this.step
    ) return;

    if (next > 1 && !this.canAdvanceArticle) return;
    if (next > 2 && !this.canAdvanceCustomer) return;

    this.step = next;
    this.cdr.markForCheck();
  }

  selectedSerial(id: number): boolean {
    return this.selectedSerialIds.includes(id);
  }

  toggleSerial(id: number, checked: boolean): void {
    this.selectedSerialIds = checked
      ? [...this.selectedSerialIds, id]
      : this.selectedSerialIds.filter(x => x !== id);

    this.form.controls.quantity.setValue(
      this.selectedSerialIds.length
    );
  }

  // Mantener el RUC como texto para no perder ceros iniciales.
  onRucInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 11);

    input.value = value;
    this.rucQuery = value;

    this.rucRequest?.unsubscribe();
    this.rucRequest = undefined;

    this.loadingRuc = false;
    this.sunatResult = null;
    this.sunatError = '';

    this.cdr.markForCheck();
  }

  consultarRuc(): void {
    const ruc = this.rucQuery.trim();

    if (this.loadingRuc) return;

    if (!/^\d{11}$/.test(ruc)) {
      this.sunatError = 'El RUC debe contener 11 dígitos.';
      return;
    }

    this.loadingRuc = true;
    this.sunatError = '';
    this.sunatResult = null;
    this.cdr.markForCheck();

    this.rucRequest = this.sunatApi.ruc(ruc)
      .pipe(timeout(20000))
      .subscribe({
        next: result => {
          if (this.rucQuery !== ruc) return;

          this.loadingRuc = false;
          this.sunatResult = result;

          if (result.businessName?.trim()) {
            this.form.controls.customerName.setValue(
              result.businessName.trim()
            );
          }

          this.cdr.markForCheck();
        },
        error: err => {
          if (this.rucQuery !== ruc) return;

          this.loadingRuc = false;
          this.sunatError = String(
            err?.error?.error ||
            (
              err?.status === 0
                ? 'No se pudo conectar con la API.'
                : 'No fue posible consultar el RUC.'
            )
          );

          this.cdr.markForCheck();
        }
      });
  }

  onSubmit(): void {
    if (!this.canSubmit) return;

    this.submitting = true;
    const data = this.form.getRawValue();

    this.salesApi.quickSale({
      articleId: Number(data.articleId),
      quantity: Number(data.quantity),
      unitPrice: Number(data.unitPrice),
      customerName: data.customerName || '',
      paymentMethod: data.paymentMethod || 'Efectivo',
      notes: data.notes || '',
      operationKey: crypto.randomUUID(),
      detailIds: this.isSerialized ? this.selectedSerialIds : []
    }).subscribe({
      next: ({ saleId }) => {
        this.submitting = false;
        this.snackBar.open(
          `Venta #${saleId} registrada con stock actualizado.`,
          'Cerrar',
          { duration: 4000 }
        );
        this.dialogRef.close(true);
      },
      error: err => {
        this.submitting = false;
        this.snackBar.open(
          String(
            err?.error?.error ??
            'No se pudo registrar la venta.'
          ),
          'Cerrar',
          { duration: 6000 }
        );
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.rucRequest?.unsubscribe();
  }
}