
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
  SunatRuc,
  ReniecDni
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

  // Consulta optativa de identidad: no crea automáticamente un cliente.
  documentType: 'RUC' | 'DNI' = 'RUC';
  dniResult: ReniecDni | null = null;
  rucQuery = '';
  loadingRuc = false;
  sunatResult: SunatRuc | null = null;
  sunatError = '';
  private rucRequest?: Subscription;

  get documentLength(): number { return this.documentType === 'DNI' ? 8 : 11; }

  setDocumentType(type: 'RUC' | 'DNI'): void {
    if (this.documentType === type) return;
    this.documentType = type;
    this.rucRequest?.unsubscribe();
    this.rucQuery = '';
    this.loadingRuc = false;
    this.sunatResult = null;
    this.dniResult = null;
    this.sunatError = '';
    this.cdr.markForCheck();
  }

  readonly paymentMethods = [
    'Efectivo',
    'Tarjeta',
    'Billetera digital',
    'Transferencia',
    'Cuotas'
  ];

  readonly wallets = ['Yape', 'Plin', 'Bim'];
  readonly installmentFrequencies = ['Diario', 'Semanal', 'Mensual'];

  readonly form = this.fb.group({
    articleId: [null as number | null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    customerName: ['Público general'],
    paymentMethod: ['Efectivo', Validators.required],
    notes: [''],
    walletProvider: [''],
    installmentFrequency: ['Mensual'],
    installmentCount: [3],
    downPayment: [0],
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
      this.canAdvanceCustomer &&
      this.paymentConfigurationValid;
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

  get selectedPaymentMethod(): string {
    return this.form.controls.paymentMethod.value || 'Efectivo';
  }

  get isDigitalWallet(): boolean {
    return this.selectedPaymentMethod === 'Billetera digital';
  }

  get isInstallmentSale(): boolean {
    return this.selectedPaymentMethod === 'Cuotas';
  }

  get effectivePaymentMethod(): string {
    return this.isDigitalWallet
      ? this.form.controls.walletProvider.value || ''
      : this.selectedPaymentMethod;
  }

  onPaymentTypeChanged(): void {
    this.form.controls.walletProvider.setValue('');

    if (!this.isInstallmentSale) {
      this.form.controls.installmentFrequency.setValue('Mensual');
      this.form.controls.installmentCount.setValue(3);
      this.form.controls.downPayment.setValue(0);
    }
  }

  get installmentCount(): number {
    return Number(this.form.controls.installmentCount.value);
  }

  get downPayment(): number {
    return Number(this.form.controls.downPayment.value);
  }

  get financedAmount(): number {
    return Math.max(
      0,
      (Math.round(this.total * 100) -
        Math.round(this.downPayment * 100)) / 100
    );
  }

  get paymentConfigurationValid(): boolean {
    if (this.isDigitalWallet) {
      return this.wallets.includes(
        this.form.controls.walletProvider.value || ''
      );
    }

    if (!this.isInstallmentSale) return true;

    const count = this.installmentCount;
    const advance = this.downPayment;
    const customer = (
      this.form.controls.customerName.value || ''
    ).trim();

    return Number.isInteger(count) &&
      count >= 2 &&
      count <= 120 &&
      Number.isFinite(advance) &&
      advance >= 0 &&
      Math.round(advance * 100) === advance * 100 &&
      advance < this.total &&
      Math.round(this.financedAmount * 100) >= count &&
      ['Diario', 'Semanal', 'Mensual'].includes(
        this.form.controls.installmentFrequency.value || ''
      ) &&
      !!customer &&
      customer.toLocaleLowerCase('es') !== 'público general';
  }

  get installmentSchedule(): Array<{
    number: number;
    date: Date;
    amount: number;
  }> {
    if (!this.isInstallmentSale) return [];

    const count = this.installmentCount;
    const totalCents = Math.round(this.financedAmount * 100);

    if (
      !Number.isInteger(count) ||
      count < 2 ||
      count > 120 ||
      totalCents < count
    ) return [];

    const frequency =
      this.form.controls.installmentFrequency.value;

    const baseCents = Math.floor(totalCents / count);
    const remainder = totalCents % count;
    const initialDate = new Date();
    initialDate.setHours(12, 0, 0, 0);

    return Array.from({ length: count }, (_, index) => {
      const installmentNumber = index + 1;
      let date: Date;

      if (frequency === 'Mensual') {
        const year = initialDate.getFullYear();
        const month = initialDate.getMonth() + installmentNumber;
        const lastDay = new Date(year, month + 1, 0).getDate();

        date = new Date(
          year,
          month,
          Math.min(initialDate.getDate(), lastDay),
          12
        );
      } else {
        date = new Date(initialDate);

        date.setDate(
          date.getDate() +
          installmentNumber * (frequency === 'Semanal' ? 7 : 1)
        );
      }

      const cents = baseCents + (index < remainder ? 1 : 0);

      return {
        number: installmentNumber,
        date,
        amount: cents / 100
      };
    });
  }

  get creditBuyerMissing(): boolean {
    const customer = (
      this.form.controls.customerName.value || ''
    ).trim().toLocaleLowerCase('es');

    return !customer || customer === 'público general';
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
    const value = input.value.replace(/\D/g, '').slice(0, this.documentLength);

    input.value = value;
    this.rucQuery = value;

    this.rucRequest?.unsubscribe();
    this.rucRequest = undefined;

    this.loadingRuc = false;
    this.sunatResult = null;
    this.dniResult = null;
    this.sunatError = '';

    this.cdr.markForCheck();
  }

  consultarRuc(): void {
    const type = this.documentType;
    const document = this.rucQuery.trim();
    if (this.loadingRuc) return;
    if (!new RegExp('^\\d{' + this.documentLength + '}$').test(document)) {
      this.sunatError = 'El ' + type + ' debe contener ' + this.documentLength + ' dígitos.';
      this.cdr.markForCheck();
      return;
    }
    this.loadingRuc = true;
    this.sunatError = '';
    this.sunatResult = null;
    this.dniResult = null;
    this.cdr.markForCheck();

    const onFailure = (err: { error?: { error?: string }; status?: number }) => {
      if (this.rucQuery !== document || this.documentType !== type) return;
      this.loadingRuc = false;
      this.sunatError = String(err?.error?.error ||
        (err?.status === 0 ? 'No se pudo conectar con la API.' : 'No fue posible consultar el ' + type + '.'));
      this.cdr.markForCheck();
    };
    if (type === 'RUC') {
      this.rucRequest = this.sunatApi.ruc(document).pipe(timeout(20000)).subscribe({
        next: result => {
          if (this.rucQuery !== document || this.documentType !== type) return;
          this.loadingRuc = false;
          this.sunatResult = result;
          if (result.businessName?.trim()) this.form.controls.customerName.setValue(result.businessName.trim());
          this.cdr.markForCheck();
        },
        error: onFailure
      });
    } else {
      this.rucRequest = this.sunatApi.dni(document).pipe(timeout(20000)).subscribe({
        next: result => {
          if (this.rucQuery !== document || this.documentType !== type) return;
          this.loadingRuc = false;
          this.dniResult = result;
          const name = [result.first_name, result.first_last_name, result.second_last_name]
            .map(p => String(p ?? '').trim()).filter(Boolean).join(' ');
          if (name) this.form.controls.customerName.setValue(name);
          else this.sunatError = 'RENIEC no devolvió un nombre completo. Puedes ingresarlo manualmente.';
          this.cdr.markForCheck();
        },
        error: onFailure
      });
    }
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
      paymentMethod: this.effectivePaymentMethod,
      notes: data.notes || '',
      operationKey: crypto.randomUUID(),
      detailIds: this.isSerialized ? this.selectedSerialIds : [],
      
      installmentFrequency: this.isInstallmentSale
      ? this.form.controls.installmentFrequency.value || 'Mensual'
      : undefined,

      installmentCount: this.isInstallmentSale
        ? this.installmentCount
        : undefined,

      downPayment: this.isInstallmentSale
        ? this.downPayment
        : undefined
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