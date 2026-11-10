import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BrowserMultiFormatReader } from '@zxing/browser';

import { CategoryService } from '../../categories/services/category';
import { BrandService } from '../../../core/services/brands';
import { Brand } from '../../../core/models/brand.model';
import { ArticleService } from '../../../core/services/articles';
import { InventoryContextService } from '../../../core/services/inventory-context';
import { Article, ArticleDetail } from '../../../core/models/article.model';
import { BrandDialogComponent, BrandDialogData } from '../brand-dialog/brand-dialog';
import { isMeasuredUnit, isPackUnit, isUnitName, isUnitConversion, fixedUnitFactor, validPieces, validQuantity, quantityStep, quantityLabel } from '../../../shared/inventory/inventory-units';
import {MeasurementUnitsService, MeasurementUnit} from '../../../core/services/measurement-units';

interface AttributeField {
  control: string;
  label: string;
}

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './article-form.html',
  styleUrls: ['./article-form.scss']
})
export class ArticleFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);
  private articleService = inject(ArticleService);
  private inventoryContext = inject(InventoryContextService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private readonly measurementUnitsService = inject(MeasurementUnitsService);
  private todasLasUnidades: MeasurementUnit[] = [];
  public dialogRef = inject(MatDialogRef<ArticleFormComponent>);
  public data = inject(MAT_DIALOG_DATA, { optional: true });

  identityForm!: FormGroup;
  logisticsForm!: FormGroup;
  financeForm!: FormGroup;

  categoriasHijas: any[] = [];
  marcasGlobales: Brand[] = [];
  marcasFiltradas: Brand[] = [];
  isLoadingCategories = false;
  isLoadingBrands = false;
  categoriesError = '';
  brandsError = '';
  unidades: string[] = [];
  private previousPurchaseUnit = '';
  unitLoadError = '';

  // IMPORTANTE: cotización fija original, no es el tipo de cambio de hoy.
  monedas = [{ code: 'S/.', rate: 1 }, { code: 'USD', rate: 3.85 }];
  currentTrackingMode = '';

  utilityPerUnit = 0;
  marginPercent = 0; // Ganancia sobre costo, según cálculo original.
  profitabilityRatio = 0;
  isLoss = false;
  hasFinancialEstimate = false;

  // Archivos seleccionados: se conservan al alternar las pestañas.
  mainPhotoPreview: string | null = null;
  mainPhotoFile: File | null = null;
  voucherPreview: string | null = null;
  voucherFile: File | null = null;
  voucherPdfPreview: SafeResourceUrl | null = null;
  isVoucherPdf = false;

  @ViewChild('mediaViewer') mediaViewer?: ElementRef<HTMLDialogElement>;
  mediaPreviewKind: 'photo' | 'voucher' | null = null;
  mediaPreviewZoom = 1;
  mediaPanX = 0;
  mediaPanY = 0;
  isMediaDragging = false;
  private mediaPointerId: number | null = null;
  private mediaDragOriginX = 0;
  private mediaDragOriginY = 0;
  private mediaDragStartX = 0;
  private mediaDragStartY = 0;

  get mediaZoomPercent(): number { return Math.round(this.mediaPreviewZoom * 100); }

  get mediaPreviewTitle(): string {
    if (this.mediaPreviewKind === 'photo') return this.mainPhotoFile?.name || 'Foto principal';
    if (this.mediaPreviewKind === 'voucher') return this.voucherFile?.name || 'Comprobante';
    return 'Vista ampliada';
  }

  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  isCameraOpen = false;
  isOpeningCamera = false;
  isCapturingPhoto = false;
  private cameraStream: MediaStream | null = null;
  private cameraRequestId = 0;
  private photoObjectUrl: string | null = null;
  private voucherObjectUrl: string | null = null;

  codeReader = new BrowserMultiFormatReader();
  isScanning = false;
  isEditMode = false;
  isSaving = false;
  private existingArticle: Article | null = null;
  /* FASE 4.1 */
  extraSerialNumbers: string[] = [];

  get additionalSerialIndexes(): number[] {
    if (this.currentTrackingMode !== 'Serializado' || this.isEditMode) return [];
    const count = Number(this.logisticsForm?.get('stock')?.value);
    if (!Number.isInteger(count) || count < 1 || count > 1000) return [];
    return Array.from({length: count - 1}, (_, i) => i);
  }
  trackBySerialIndex(index: number): number { return index; }
  setExtraSerial(index: number, event: Event): void {
    this.extraSerialNumbers[index] = (event.target as HTMLInputElement).value;
  }
  get hasSeveralExistingSerials(): boolean {
    return (this.existingArticle?.details ?? this.existingArticle?.articleDetails ?? []).length > 1;
  }
  private editHydrated = false;
  private removedPhoto = false;
  private removedVoucher = false;

  currentStep = 1;
  activeSubTab: 'general' | 'attributes' | 'images' = 'general';
  attemptedNext = false;
  attemptedLogistics = false;
  attemptedSave = false;
  // El mensaje vuelve a informativo al reingresar al campo; reaparece solo tras validar.
  private readonly clearedMessages = new Set<string>();
  initialQuantityLabel = 'Cantidad inicial de compra';
  pricesIncludeIgv = true;
  readonly igvRate = 0.18; // Estimación IGV + IPM vigente en Perú (2026).
  igvSalePerUnit = 0;
  igvCostPerUnit = 0;
  igvDifferencePerUnit = 0;
  netSalePerUnit = 0;
  netCostPerUnit = 0;
  // MODAL_SERIES_FINANZAS_2026: paquetes serializados en alta, no modificación de existencias en edición.
  
  get requiresUnitConversion(): boolean {
    return isUnitConversion(
      String(this.logisticsForm?.get('acqUnit')?.value ?? ''),
      String(this.logisticsForm?.get('saleUnit')?.value ?? '')
    );
  }
  get isPhysicalPurchase(): boolean {
    return isMeasuredUnit(String(this.logisticsForm?.get('acqUnit')?.value ?? ''));
  }
  get fixedFactor(): number | null {
    if (!this.requiresUnitConversion) return null;
    return fixedUnitFactor(String(this.logisticsForm?.get('acqUnit')?.value ?? ''));
  }
  get purchaseStep(): number {
    return quantityStep(String(this.logisticsForm?.get('acqUnit')?.value ?? ''));
  }
  get stockStep(): number {
    return quantityStep(String(this.logisticsForm?.get('saleUnit')?.value ?? ''));
  }
  get saleUnits(): string[] {
    const purchase = String(this.logisticsForm?.get('acqUnit')?.value ?? '');
    if (!purchase) return this.unidades;
    if (this.isEditMode && this.existingArticle &&
        Number(this.existingArticle.categoryId) === Number(this.selectedCategory?.id)) {
      const original = this.existingArticle.saleUnit ?? this.existingArticle.measurementUnit;
      if (original && original !== purchase && !isMeasuredUnit(purchase)) {
        return [...new Set([purchase, ...this.unidades.filter(isUnitName), original])];
      }
    }
    if (isPackUnit(purchase)) return [...new Set([purchase, ...this.unidades.filter(isUnitName)])];
    return [purchase];
  }

  resetFieldMessage(section: 'identity' | 'logistics' | 'finance', name: string): void {
    this.clearedMessages.add(section + '.' + name);
    if (section === 'identity' && name !== 'name') this.clearedMessages.add('identity.name');
  }
  private validateAgain(section: 'identity' | 'logistics' | 'finance'): void {
    for (const key of Array.from(this.clearedMessages)) if (key.startsWith(section + '.')) this.clearedMessages.delete(key);
  }
  setPricesIncludeIgv(event: Event): void {
    this.pricesIncludeIgv = (event.target as HTMLInputElement).checked;
    this.calculateProfit();
  }

  private cargarUnidades(): void {
    this.measurementUnitsService.getAll().subscribe({
      next: (unidades) => {
        this.todasLasUnidades = unidades;
        this.actualizarUnidadesPermitidas();
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open(
          'No se pudieron cargar las unidades de medida.',
          'Cerrar',
          { duration: 4000 }
        );
      }
    });
  }

  private actualizarUnidadesPermitidas(): void {
    const categoria = this.selectedCategory;

    if (!categoria) {
      this.unidades = [];
      return;
    }

    if (!this.todasLasUnidades.length) return;

    const ids = new Set<number>(
      (categoria.selectedUnitIds ?? []).map(Number)
    );

    // Categorías antiguas sin configuración: compatibilidad temporal.
    const permitidas = ids.size
      ? this.todasLasUnidades.filter(u => ids.has(u.id))
      : this.todasLasUnidades;

    this.unidades = [
      ...new Set(permitidas.map(u => u.unitName.trim()))
    ];

    // En edición, conservar los valores históricos del artículo.
    if (
      this.isEditMode &&
      this.existingArticle &&
      Number(this.existingArticle.categoryId) === Number(categoria.id)
    ) {
      const articulo = this.existingArticle;

      const anteriores = [
        articulo.acquisitionUnit,
        articulo.saleUnit ?? articulo.measurementUnit
      ];

      for (const unidad of anteriores) {
        if (unidad && !this.unidades.includes(unidad)) {
          this.unidades.push(unidad);
        }
      }
    }

    const primeraUnidad = this.unidades[0];
    if (!primeraUnidad) return;

    for (const campo of ['acqUnit', 'saleUnit']) {
      const control = this.logisticsForm.get(campo);

      if (control && !this.unidades.includes(String(control.value))) {
        control.setValue(primeraUnidad, { emitEvent: false });
      }
    }

    this.syncUnitConversion(false);
  }

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;
    this.initForms();
    this.setupSubscriptions();
    this.cargarUnidades();
    this.loadCatalogs();
    if (this.isEditMode) {
      this.articleService.getArticle(Number(this.data.id)).subscribe({
        next: (article) => {
          this.existingArticle = article;
          this.applyExistingArticle();
        },
        error: () => this.snackBar.open('No se pudieron cargar los datos del artículo para editar.', 'Cerrar', { duration: 5000 })
      });
    }
  }

  ngOnDestroy(): void {
    this.closeMediaPreview();
    this.stopCamera();
    this.releaseObjectUrl('photo');
    this.releaseObjectUrl('voucher');
  }

  initForms(): void {
    this.identityForm = this.fb.group({
      id: [this.data?.id || 0],
      categoryId: [null, Validators.required],
      brandId: [null, Validators.required],
      barcode: [''],
      sku: [''],
      name: [{ value: '', disabled: true }, Validators.required],
      model: [''],
      presentation: [''],
      serialNumber: [''],
      attr1: [''],
      attr2: [''],
      attr3: [''],
      attr4: [''],
      attr5: [''],
      attr6: ['']
    });

    this.logisticsForm = this.fb.group({
      acqUnit: ['Unidad', Validators.required],
      saleUnit: ['Unidad', Validators.required],
      conversionFactor: [1, [Validators.required, Validators.min(0.01)]],
      initialQuantity: [null],
      stock: [{ value: 0, disabled: true }, [Validators.required, Validators.min(0)]]
    });

    this.financeForm = this.fb.group({
      acqPrice: [null, Validators.min(0)],
      acqCurrency: ['S/.', Validators.required],
      salePrice: [null, Validators.min(0)],
      saleCurrency: ['S/.', Validators.required]
    });
  }

  get selectedCategory(): any | null {
    const id = this.identityForm?.get('categoryId')?.value;
    return this.categoriasHijas.find(cat => Number(cat.id) === Number(id)) ?? null;
  }

  // Referencias estables: evita recrear los inputs en cada pulsación.
  attributeFields: AttributeField[] = [];
  trackByAttribute(_index: number, field: AttributeField): string { return field.control; }

  private refreshAttributeFields(category: any | null): void {
    this.attributeFields = [];
    if (category) {
      for (let i = 1; i <= 6; i++) {
        const label = category[`label${i}`];
        if (typeof label === 'string' && label.trim()) {
          this.attributeFields.push({ control: `attr${i}`, label: label.trim() });
        }
      }
    }
    if (!this.attributeFields.length && this.activeSubTab === 'attributes') {
      this.activeSubTab = 'general';
    }
  }

  get isIdentityComplete(): boolean {
    if (!this.identityForm || this.identityForm.invalid) return false;
    return String(this.identityForm.get('name')?.value ?? '').trim().length > 0;
  }

  get showNameError(): boolean {
    return this.attemptedNext && !this.clearedMessages.has('identity.name') &&
      !String(this.identityForm.get('name')?.value ?? '').trim();
  }

  isInvalid(section: 'identity' | 'logistics' | 'finance', name: string): boolean {
    const form = section === 'identity' ? this.identityForm :
      section === 'logistics' ? this.logisticsForm : this.financeForm;
    const control = form?.get(name);
    if (!control) return false;
    const wasSubmitted = section === 'identity' ? this.attemptedNext :
      section === 'logistics' ? this.attemptedLogistics : this.attemptedSave;
    return !!control.invalid && (control.touched || wasSubmitted) &&
      !this.clearedMessages.has(section + '.' + name);
  }

  loadCatalogs(): void {
    this.loadCategories();
    this.loadBrands();
  }

  loadCategories(refresh = false): void {
    this.isLoadingCategories = true;
    this.categoriesError = '';
    this.categoryService.getCategories(refresh).subscribe({
      next: (cats) => {
        // Solo subcategorías activas, nunca categorías padre ni inactivas.
        this.categoriasHijas = (Array.isArray(cats) ? cats : [])
          .filter(c => c.isActive && c.parentCategoryId != null && Number(c.parentCategoryId) > 0)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.isLoadingCategories = false;
        if (!this.categoriasHijas.length) {
          this.categoriesError = 'La API no devolvió categorías hijas activas.';
        }
        const currentId = this.identityForm.get('categoryId')?.value;
        if (currentId != null && !this.categoriasHijas.some(c => Number(c.id) === Number(currentId))) {
          this.identityForm.get('categoryId')?.setValue(null);
        } else if (currentId != null) {
          this.handleCategoryChange(currentId);
        }
        this.applyExistingArticle();
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingCategories = false;
        this.categoriasHijas = [];
        this.categoriesError = error.status === 0
          ? 'No se pudo conectar con la API de categorías.'
          : `No se pudieron cargar las categorías (HTTP ${error.status}).`;
        this.cdr.markForCheck();
      }
    });
  }

  loadBrands(selectedBrandId?: number, refresh = false): void {
    this.isLoadingBrands = true;
    this.brandsError = '';
    this.brandService.getBrands(refresh).subscribe({
      next: (brands) => {
        this.marcasGlobales = (Array.isArray(brands) ? brands : [])
          .filter(b => b.isActive);
        this.isLoadingBrands = false;
        this.filterBrandsForSelectedCategory();
        this.generateAutoName();
        if (selectedBrandId != null) {
          const brand = this.marcasFiltradas.find(b => Number(b.id) === Number(selectedBrandId));
          if (brand) this.identityForm.get('brandId')?.setValue(brand.id);
          else this.brandsError = 'La nueva marca no aparece aún en el catálogo. Actualiza el listado.';
        }
        this.applyExistingArticle();
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingBrands = false;
        this.brandsError = error.status === 0
          ? 'No se pudo conectar con la API de marcas.'
          : `No se pudieron cargar las marcas (HTTP ${error.status}).`;
        this.cdr.markForCheck();
      }
    });
  }

  /** Aplica los datos de edición UNA sola vez, después de recibir artículo, categorías y marcas. */
  private applyExistingArticle(): void {
    if (this.editHydrated || !this.existingArticle || this.isLoadingBrands ||
        this.isLoadingCategories || !this.categoriasHijas.length || !this.marcasGlobales.length) return;
    const a = this.existingArticle;
    if (!this.categoriasHijas.some(c => Number(c.id) === Number(a.categoryId))) {
      this.snackBar.open('La categoría del artículo no está disponible para edición.', 'Cerrar', { duration: 4500 });
      return;
    }
    this.editHydrated = true;
    this.identityForm.get('categoryId')?.setValue(a.categoryId, { emitEvent: false });
    this.handleCategoryChange(a.categoryId);
    const detail: ArticleDetail | undefined = (a.details ?? a.articleDetails ?? [])[0];
    let attrs: Record<string, string> = {};
    try { attrs = a.characteristics ? JSON.parse(a.characteristics) : {}; } catch { /* dato legado libre */ }
    this.identityForm.patchValue({
      id: a.id, categoryId: a.categoryId, brandId: a.brandId ?? null,
      barcode: a.barcode ?? '', sku: a.code ?? '', name: a.name,
      model: a.model ?? '', presentation: a.presentation ?? '',
      serialNumber: a.serialNumber ?? detail?.serialNumber ?? '',
      attr1: detail?.attr1 ?? attrs['attr1'] ?? '',
      attr2: detail?.attr2 ?? attrs['attr2'] ?? '',
      attr3: detail?.attr3 ?? attrs['attr3'] ?? '',
      attr4: detail?.attr4 ?? attrs['attr4'] ?? '',
      attr5: detail?.attr5 ?? attrs['attr5'] ?? '',
      attr6: detail?.attr6 ?? attrs['attr6'] ?? ''
    }, { emitEvent: false });
    this.logisticsForm.patchValue({
      acqUnit: a.acquisitionUnit ?? 'Unidad', saleUnit: a.saleUnit ?? a.measurementUnit ?? 'Unidad',
      conversionFactor: a.conversionFactor ?? 1, stock: a.stock,
      initialQuantity: a.stock / Math.max((fixedUnitFactor(String(a.acquisitionUnit ?? '')) ?? Number(a.conversionFactor)) || 1, 0.01)
    }, { emitEvent: false });
    this.actualizarUnidadesPermitidas();
    this.syncUnitConversion(false);
    this.financeForm.patchValue({
      acqPrice: a.acquisitionPrice ?? null,
      acqCurrency: a.acquisitionCurrency ?? 'S/.',
      salePrice: a.salePrice ?? null,
      saleCurrency: a.saleCurrency ?? 'S/.'
    }, { emitEvent: false });
    this.filterBrandsForSelectedCategory();
    this.identityForm.get('brandId')?.setValue(a.brandId ?? null, { emitEvent: false });
    this.generateAutoName();
    // El nombre histórico se mantiene intacto hasta que el usuario cambie un dato.
    this.identityForm.get('name')?.setValue(a.name, { emitEvent: false });
    if (a.mainPhotoPath) this.loadExistingMedia(a.id, 'photo');
    if (a.mainVoucherPath) this.loadExistingMedia(a.id, 'voucher');
    this.cdr.markForCheck();
  }

  private loadExistingMedia(id: number, kind: 'photo' | 'voucher'): void {
    this.articleService.getMedia(id, kind).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (kind === 'photo') {
          this.releaseObjectUrl('photo');
          this.photoObjectUrl = url;
          this.mainPhotoPreview = url;
        } else {
          this.releaseObjectUrl('voucher');
          this.voucherObjectUrl = url;
          this.isVoucherPdf = blob.type === 'application/pdf';
          this.voucherPreview = url;
          if (this.isVoucherPdf) this.voucherPdfPreview = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        }
        this.cdr.markForCheck();
      },
      error: () => { /* Archivo legado no encontrado, se puede reemplazar. */ }
    });
  }

  private filterBrandsForSelectedCategory(): void {
    const categoryId = this.identityForm.get('categoryId')?.value;
    this.marcasFiltradas = categoryId == null ? [] : this.marcasGlobales
      .filter(b => Number(b.categoryId) === Number(categoryId))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const brandId = this.identityForm.get('brandId')?.value;
    if (brandId != null && !this.marcasFiltradas.some(b => Number(b.id) === Number(brandId))) {
      this.identityForm.get('brandId')?.setValue(null);
    }
  }

  setupSubscriptions(): void {
    this.identityForm.get('categoryId')?.valueChanges.subscribe(catId => this.handleCategoryChange(catId));
    const identityControls = [
      'brandId', 'barcode', 'sku', 'model', 'presentation', 'serialNumber',
      'attr1', 'attr2', 'attr3', 'attr4', 'attr5', 'attr6'
    ];
    identityControls.forEach(name => {
      this.identityForm.get(name)?.valueChanges.subscribe(() => this.generateAutoName());
    });
    ['acqPrice', 'salePrice', 'acqCurrency', 'saleCurrency'].forEach(name => {
      this.financeForm.get(name)?.valueChanges.subscribe(() => this.calculateProfit());
    });
    ['acqUnit', 'saleUnit', 'conversionFactor', 'initialQuantity'].forEach(name => {
      this.logisticsForm.get(name)?.valueChanges.subscribe(() => {
        this.resetFieldMessage('logistics', name);
        this.syncUnitConversion(name === 'acqUnit' || name === 'saleUnit');
      });
    });
  }

  private syncUnitConversion(unitsChanged = false): void {
    const initial = this.logisticsForm.get('initialQuantity');
    const factor = this.logisticsForm.get('conversionFactor');
    const stock = this.logisticsForm.get('stock');
    const purchase = this.logisticsForm.get('acqUnit');
    const sale = this.logisticsForm.get('saleUnit');
    const purchaseName = String(purchase?.value ?? '');
    const purchaseChanged = !!this.previousPurchaseUnit && this.previousPurchaseUnit !== purchaseName;
    this.previousPurchaseUnit = purchaseName;
    if (purchaseChanged && !this.isEditMode) {
      initial?.setValue(null, {emitEvent:false});
      if (fixedUnitFactor(purchaseName) === null) factor?.setValue(null, {emitEvent:false});
    }
    const serialized = this.currentTrackingMode === 'Serializado';
    const editingSerialized = serialized && this.isEditMode;
    if (isMeasuredUnit(purchaseName)) {
      if (sale?.value !== purchaseName) sale?.setValue(purchaseName, {emitEvent:false});
      if (sale?.enabled) sale.disable({emitEvent:false});
    } else {
      if (sale?.disabled) sale.enable({emitEvent:false});
      if (purchaseName && !this.saleUnits.includes(String(sale?.value ?? ''))) {
        const unitOption = this.saleUnits.find(isUnitName);
        sale?.setValue(unitOption ?? this.saleUnits[0] ?? purchaseName, {emitEvent:false});
      }
    }
    const saleName = String(sale?.value ?? '');
    const conversion = isUnitConversion(purchaseName, saleName);
    const fixed = conversion ? fixedUnitFactor(purchaseName) : null;
    this.initialQuantityLabel = quantityLabel(purchaseName);
    const existingStock = Number(stock?.value);
    if (conversion) {
      if (fixed !== null) factor?.setValue(fixed, {emitEvent:false});
      factor?.setValidators([Validators.required, Validators.min(1), Validators.pattern(/^[1-9]\d*$/)]);
      initial?.setValidators([Validators.required, Validators.min(serialized ? 1 : 0),
        Validators.pattern(serialized ? /^[1-9]\d*$/ : /^\d+$/)]);
      if (editingSerialized) {
        const ratio = Number(factor?.value);
        initial?.setValue(ratio > 0 ? existingStock / ratio : null, {emitEvent:false});
        initial?.clearValidators();
      } else {
        const quantity = Number(initial?.value);
        const ratio = Number(factor?.value);
        const valid = validPieces(initial?.value, serialized) && validPieces(factor?.value, true);
        stock?.setValue(valid ? quantity * ratio : null, {emitEvent:false});
      }
    } else {
      initial?.clearValidators();
      initial?.setValue(null, {emitEvent:false});
      factor?.setValidators([Validators.required, Validators.min(1)]);
      factor?.setValue(1, {emitEvent:false});
    }
    const stockValidators = serialized
      ? [Validators.required, Validators.min(1), Validators.max(1000), Validators.pattern(/^[1-9]\d*$/)]
      : isMeasuredUnit(saleName)
        ? [Validators.required, Validators.min(0), Validators.pattern(/^\d+(?:\.\d{1,2})?$/)]
        : [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)];
    stock?.setValidators(stockValidators);
    if (!this.selectedCategory || editingSerialized) stock?.disable({emitEvent:false});
    else stock?.enable({emitEvent:false});
    factor?.updateValueAndValidity({emitEvent:false});
    initial?.updateValueAndValidity({emitEvent:false});
    stock?.updateValueAndValidity({emitEvent:false});
    this.calculateProfit();
  }

  setStep(step: number): void {
    if (step < 1 || step > 3 || step === this.currentStep) return;
    if (step > 1 && !this.isIdentityComplete) {
      this.goNextFromIdentity();
      return;
    }
    if (step > 2 && this.logisticsForm.invalid) {
      this.goNextFromLogistics();
      return;
    }
    if (step !== 1) this.stopCamera();
    this.currentStep = step;
    this.attemptedNext = false;
  }

  setSubTab(tab: 'general' | 'attributes' | 'images'): void {
    if (tab === 'attributes' && !this.attributeFields.length) return;
    if (tab !== 'images') this.stopCamera();
    this.activeSubTab = tab;
  }

  goNextFromIdentity(): void {
    this.validateAgain('identity');
    this.attemptedNext = true;
    this.identityForm.markAllAsTouched();
    if (!this.isIdentityComplete) {
      // El nombre se muestra en Atributos únicamente cuando la categoría los configura.
      const needsName = !String(this.identityForm.get('name')?.value ?? '').trim();
      const identificationComplete = ['categoryId', 'brandId', 'barcode', 'sku', 'serialNumber']
        .every(key => !this.identityForm.get(key)?.invalid);
      this.activeSubTab = needsName && identificationComplete && this.attributeFields.length > 0
        ? 'attributes' : 'general';
      this.snackBar.open('Completa los datos requeridos de Identidad.', 'Cerrar', { duration: 3200 });
      return;
    }
    this.stopCamera();
    this.currentStep = 2;
  }

  goNextFromLogistics(): void {
    this.validateAgain('logistics');
    this.attemptedLogistics = true;
    this.logisticsForm.markAllAsTouched();
    if (this.logisticsForm.invalid) {
      this.snackBar.open('Revisa los datos de Logística.', 'Cerrar', { duration: 3200 });
      return;
    }
    this.currentStep = 3;
  }

  handleCategoryChange(catId: number | string | null): void {
    const category = this.categoriasHijas.find(cat => Number(cat.id) === Number(catId));
    this.currentTrackingMode = '';
    this.refreshAttributeFields(category);
    this.marcasFiltradas = [];
    this.identityForm.get('brandId')?.setValue(null, { emitEvent: false });

    const barcode = this.identityForm.get('barcode');
    const sku = this.identityForm.get('sku');
    const serial = this.identityForm.get('serialNumber');
    barcode?.clearValidators();
    sku?.clearValidators();
    serial?.clearValidators();

    if (!category || catId == null) {
      this.logisticsForm.get('stock')?.disable({ emitEvent: false });
      this.identityForm.get('name')?.setValue('', { emitEvent: false });
      this.identityForm.get('name')?.disable({ emitEvent: false });
    } else {
      const mode = String(category.trackingMode ?? '0').toLowerCase();
      this.currentTrackingMode = (mode === 'serialized' || mode === 'serializado' || mode === '1') ? 'Serializado'
        : (mode === 'bulk' || mode === 'a granel' || mode === '2') ? 'A Granel' : 'Estándar';

      this.filterBrandsForSelectedCategory();

      if (this.currentTrackingMode === 'Serializado') {
        serial?.setValidators(Validators.required);
        const stock = this.logisticsForm.get('stock');
        stock?.setValidators([Validators.required, Validators.min(1), Validators.max(1000), Validators.pattern(/^[1-9]\d*$/)]);
        if (!this.isEditMode) {
          stock?.setValue(1, { emitEvent: false });
          stock?.enable({ emitEvent: false });
          this.extraSerialNumbers = [];
        } else stock?.disable({ emitEvent: false });
        stock?.updateValueAndValidity({ emitEvent: false });
      } else {
        if (this.currentTrackingMode === 'A Granel') sku?.setValidators(Validators.required);
        else barcode?.setValidators(Validators.required);
        const stock = this.logisticsForm.get('stock');
        stock?.setValidators([Validators.required, Validators.min(0)]);
        stock?.enable({ emitEvent: false });
        stock?.updateValueAndValidity({ emitEvent: false });
      }
    }

    [barcode, sku, serial].forEach(control => control?.updateValueAndValidity({ emitEvent: false }));
    this.actualizarUnidadesPermitidas();
    this.syncUnitConversion(false);
    this.generateAutoName();
  }

  agregarNuevaMarca(): void {
    const category = this.selectedCategory;
    if (!category) {
      this.snackBar.open('Primero selecciona una categoría hija.', 'Cerrar', { duration: 3000 });
      return;
    }

    const data: BrandDialogData = {
      categoryId: Number(category.id),
      categoryName: String(category.name),
      inventoryId: Number(category.inventoryId),
      selectedBrandId: this.identityForm.get('brandId')?.value ?? null
    };
    const dialogRef = this.dialog.open(BrandDialogComponent, {
      width: '530px',
      maxWidth: 'calc(100vw - 20px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      disableClose: true,
      data
    });
    // Si el servidor creó o reutilizó un ID, el artículo lo selecciona automáticamente.
    dialogRef.afterClosed().subscribe((changed?: boolean | { brandId: number }) => {
      if (changed) this.loadBrands(typeof changed === 'object' ? changed.brandId : undefined, true);
    });
  }

  generateAutoName(): void {
    const category = this.selectedCategory;
    const nameControl = this.identityForm.get('name');
    if (!category || !nameControl) return;

    const formula = String(category.namingMethod || 'Nombre');
    if (formula.toLowerCase() === 'nombre') {
      nameControl.enable({ emitEvent: false });
      return;
    }
    nameControl.disable({ emitEvent: false });

    const brandId = this.identityForm.get('brandId')?.value;
    const brand = this.marcasFiltradas.find(m => Number(m.id) === Number(brandId))?.name || '';
    const values: Record<string, string> = {
      Marca: brand,
      Código: this.stringValue('sku') || this.stringValue('barcode'),
      Modelo: this.stringValue('model'),
      'Pres.': this.stringValue('presentation'),
      Serie: this.stringValue('serialNumber')
    };
    for (let i = 1; i <= 6; i++) {
      const label = category[`label${i}`];
      if (typeof label === 'string' && label.trim()) values[label.trim()] = this.stringValue(`attr${i}`);
    }

    let result = formula;
    for (const [token, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\[${this.escapeRegExp(token)}\\]`, 'gi'), value);
    }
    result = result
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s*([+|/,\-])\s*(?=[+|/,\-]|$)/g, '')
      // '+' concatena etiquetas de la fórmula, pero jamás se muestra al usuario.
      .replace(/\s*\+\s*/g, ' ')
      .replace(/^\s*[|/,.;:\-]+\s*|\s*[|/,.;:\-]+\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    nameControl.setValue(result, { emitEvent: false });
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private stringValue(control: string): string {
    return String(this.identityForm.get(control)?.value ?? '').trim();
  }

  /** Abre la cámara tras la pulsación del usuario. Si falla, intenta abrir el selector de imágenes. */
  async openPhotoCapture(photoInput: HTMLInputElement): Promise<void> {
    if (this.isOpeningCamera || this.isCameraOpen) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      photoInput.click();
      return;
    }

    this.isOpeningCamera = true;
    const requestId = ++this.cameraRequestId;
    try {
      // getUserMedia detecta una cámara disponible y solicita permiso cuando corresponde.
      // No se depende de enumerateDevices(), que puede ocultar cámaras sin permiso.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      });
      if (requestId !== this.cameraRequestId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      this.cameraStream = stream;
      this.isCameraOpen = true;
      this.cdr.detectChanges(); // El <video> existe después de actualizar *ngIf.
      const video = this.cameraVideo?.nativeElement;
      if (!video) throw new Error('No se pudo inicializar la vista de cámara.');
      video.srcObject = stream;
      await video.play();
    } catch {
      if (requestId === this.cameraRequestId) {
        this.stopCamera();
        this.snackBar.open('No se pudo usar la cámara. Selecciona una imagen del equipo.', 'Cerrar', { duration: 3500 });
        // Los navegadores pueden limitar la apertura automática después de una operación asíncrona.
        // También queda disponible el botón «Elegir archivo».
        photoInput.click();
      }
    } finally {
      if (requestId === this.cameraRequestId) this.isOpeningCamera = false;
      this.cdr.markForCheck();
    }
  }

  async capturePhoto(): Promise<void> {
    const video = this.cameraVideo?.nativeElement;
    if (!this.isCameraOpen || !video || this.isCapturingPhoto) return;
    if (!video.videoWidth || !video.videoHeight) {
      this.snackBar.open('La cámara aún no está lista.', 'Cerrar', { duration: 2500 });
      return;
    }

    this.isCapturingPhoto = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar la captura.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('No se pudo generar la fotografía.');
      const file = new File([blob], `foto-articulo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      this.setPhotoFile(file);
    } catch {
      this.snackBar.open('No se pudo capturar la fotografía. Intenta nuevamente.', 'Cerrar', { duration: 3500 });
    } finally {
      this.isCapturingPhoto = false;
      this.cdr.markForCheck();
    }
  }

  stopCamera(): void {
    ++this.cameraRequestId; // Invalida solicitudes de permiso que sigan abiertas.
    this.cameraStream?.getTracks().forEach(track => track.stop());
    this.cameraStream = null;
    const video = this.cameraVideo?.nativeElement;
    if (video) video.srcObject = null;
    this.isCameraOpen = false;
    this.isOpeningCamera = false;
  }

  // Native <dialog> usa la capa superior del navegador, fuera del recorte
  // del modal de artículo. Es válido para fotos y PDF locales.
  openMediaPreview(kind: 'photo' | 'voucher'): void {
    const available = kind === 'photo' ? !!this.mainPhotoPreview : !!this.voucherPreview;
    if (!available) return;

    this.mediaPreviewKind = kind;
    this.resetMediaZoom();
    const dialog = this.mediaViewer?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  closeMediaPreview(): void {
    const dialog = this.mediaViewer?.nativeElement;
    if (dialog?.open) dialog.close();
    this.mediaPreviewKind = null;
    this.resetMediaZoom();
  }

  onMediaPreviewClosed(): void {
    this.mediaPreviewKind = null;
    this.resetMediaZoom();
  }

  onMediaBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeMediaPreview();
  }

  // El porcentaje se mantiene como entero para evitar redondeos tras varios clics.
  // Permite valores escritos libremente entre 25 % y 500 %.
  private setMediaZoomPercent(percent: number): void {
    if (!Number.isFinite(percent)) return;
    this.mediaPreviewZoom = Math.round(Math.max(25, Math.min(500, percent))) / 100;
  }

  adjustMediaZoom(deltaPercent: number): void {
    this.setMediaZoomPercent(this.mediaZoomPercent + deltaPercent);
  }

  onMediaZoomInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) this.setMediaZoomPercent(Number(input.value));
    input.value = String(this.mediaZoomPercent);
  }

  resetMediaZoom(): void {
    this.mediaPreviewZoom = 1;
    this.mediaPanX = 0;
    this.mediaPanY = 0;
    this.isMediaDragging = false;
    this.mediaPointerId = null;
  }

  // Pointer Events: funciona con mouse, lápiz y gestos táctiles.
  // La captura del puntero permite arrastrar incluso al salir del recuadro.
  onMediaPointerDown(event: PointerEvent): void {
    if (!this.mediaPreviewKind || (this.mediaPreviewKind === 'voucher' && this.isVoucherPdf)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.mediaPointerId !== null) return;

    this.mediaPointerId = event.pointerId;
    this.isMediaDragging = true;
    this.mediaDragOriginX = event.clientX;
    this.mediaDragOriginY = event.clientY;
    this.mediaDragStartX = this.mediaPanX;
    this.mediaDragStartY = this.mediaPanY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onMediaPointerMove(event: PointerEvent): void {
    if (this.mediaPointerId !== event.pointerId) return;
    this.mediaPanX = this.mediaDragStartX + event.clientX - this.mediaDragOriginX;
    this.mediaPanY = this.mediaDragStartY + event.clientY - this.mediaDragOriginY;
  }

  onMediaPointerUp(event: PointerEvent): void {
    if (this.mediaPointerId !== event.pointerId) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    this.mediaPointerId = null;
    this.isMediaDragging = false;
  }

  onFileSelected(event: Event, type: 'photo' | 'voucher'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Elegir de nuevo el mismo archivo también dispara (change).
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if ((type === 'photo' && !isImage) || (type === 'voucher' && !isImage && !isPdf)) {
      this.snackBar.open(type === 'photo' ? 'Selecciona un archivo de imagen.' : 'Selecciona una imagen o un PDF.', 'Cerrar', { duration: 3500 });
      return;
    }

    if (type === 'photo') this.setPhotoFile(file);
    else this.setVoucherFile(file, isPdf);
  }

  private setPhotoFile(file: File): void {
    if (this.mediaPreviewKind === 'photo') this.closeMediaPreview();
    this.stopCamera();
    this.releaseObjectUrl('photo');
    this.removedPhoto = false;
    this.mainPhotoFile = file;
    this.photoObjectUrl = URL.createObjectURL(file);
    this.mainPhotoPreview = this.photoObjectUrl;
    this.cdr.markForCheck();
  }

  private setVoucherFile(file: File, isPdf: boolean): void {
    if (this.mediaPreviewKind === 'voucher') this.closeMediaPreview();
    this.releaseObjectUrl('voucher');
    this.removedVoucher = false;
    this.voucherFile = file;
    this.isVoucherPdf = isPdf;
    const objectUrl = URL.createObjectURL(file);
    this.voucherObjectUrl = objectUrl;
    this.voucherPreview = objectUrl;
    this.voucherPdfPreview = isPdf
      ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl)
      : null;
    this.cdr.markForCheck();
  }

  removeFile(type: 'photo' | 'voucher'): void {
    if (this.mediaPreviewKind === type) this.closeMediaPreview();
    if (type === 'photo') {
      this.stopCamera();
      this.releaseObjectUrl('photo');
      this.mainPhotoFile = null;
      this.mainPhotoPreview = null;
      if (this.existingArticle?.mainPhotoPath) this.removedPhoto = true;
    } else {
      this.releaseObjectUrl('voucher');
      this.voucherFile = null;
      this.voucherPreview = null;
      if (this.existingArticle?.mainVoucherPath) this.removedVoucher = true;
      this.voucherPdfPreview = null;
      this.isVoucherPdf = false;
    }
    this.cdr.markForCheck();
  }

  private releaseObjectUrl(type: 'photo' | 'voucher'): void {
    const url = type === 'photo' ? this.photoObjectUrl : this.voucherObjectUrl;
    if (url) URL.revokeObjectURL(url);
    if (type === 'photo') this.photoObjectUrl = null;
    else this.voucherObjectUrl = null;
  }

  async scanBarcodeFromImage(event: Event, controlName: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isScanning = true;
    const imageUrl = URL.createObjectURL(file);
    try {
      const result = await this.codeReader.decodeFromImageUrl(imageUrl);
      const text = result.getText();
      if (text) {
        this.identityForm.get(controlName)?.setValue(text);
        this.snackBar.open(`Código detectado: ${text}`, 'Cerrar', { duration: 3000 });
      }
    } catch {
      this.snackBar.open('No se detectó ningún código en la imagen.', 'Cerrar', { duration: 3000 });
    } finally {
      URL.revokeObjectURL(imageUrl);
      input.value = '';
      this.isScanning = false;
    }
  }

  calculateProfit(): void {
    const acquisition = Number(this.financeForm.get('acqPrice')?.value);
    const sale = Number(this.financeForm.get('salePrice')?.value);
    const factor = this.requiresUnitConversion ? Number(this.logisticsForm.get('conversionFactor')?.value) : 1;
    if (!(acquisition > 0) || !(sale > 0) || !(factor > 0) || this.financeForm.invalid) {
      this.hasFinancialEstimate = false;
      this.utilityPerUnit = this.marginPercent = this.profitabilityRatio = 0;
      this.igvSalePerUnit = this.igvCostPerUnit = this.igvDifferencePerUnit = 0;
      this.netSalePerUnit = this.netCostPerUnit = 0;
      this.isLoss = false;
      return;
    }
    const acqRate = this.monedas.find(m => m.code === this.financeForm.get('acqCurrency')?.value)?.rate ?? 1;
    const saleRate = this.monedas.find(m => m.code === this.financeForm.get('saleCurrency')?.value)?.rate ?? 1;
    const costGross = acquisition * acqRate / factor;
    const saleGross = sale * saleRate;
    // Proyección para operaciones gravadas: si el precio incluye impuesto, separa la base.
    // No registra impuestos en el API ni reemplaza un cálculo tributario real.
    const divisor = this.pricesIncludeIgv ? 1 + this.igvRate : 1;
    this.netCostPerUnit = costGross / divisor;
    this.netSalePerUnit = saleGross / divisor;
    this.igvCostPerUnit = this.netCostPerUnit * this.igvRate;
    this.igvSalePerUnit = this.netSalePerUnit * this.igvRate;
    this.igvDifferencePerUnit = this.igvSalePerUnit - this.igvCostPerUnit;
    this.utilityPerUnit = this.netSalePerUnit - this.netCostPerUnit;
    this.marginPercent = this.netCostPerUnit > 0 ? this.utilityPerUnit / this.netCostPerUnit * 100 : 0;
    this.profitabilityRatio = this.netCostPerUnit > 0 ? this.netSalePerUnit / this.netCostPerUnit : 0;
    this.isLoss = this.utilityPerUnit < 0;
    this.hasFinancialEstimate = true;
  }

  onSubmit(): void {
    this.clearedMessages.clear();
    this.attemptedNext = true;
    this.attemptedLogistics = true;
    this.attemptedSave = true;
    this.identityForm.markAllAsTouched();
    this.logisticsForm.markAllAsTouched();
    this.financeForm.markAllAsTouched();

    if (!this.isIdentityComplete) {
      this.currentStep = 1;
      this.activeSubTab = 'general';
      this.snackBar.open('Revisa los datos de Identidad.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (this.logisticsForm.invalid) {
      this.currentStep = 2;
      this.snackBar.open('Revisa los datos de Logística.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (this.financeForm.invalid) {
      this.snackBar.open('Revisa los importes de Finanzas.', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.isSaving) return;
    const category = this.selectedCategory;
    if (!category || Number(category.inventoryId) <= 0) {
      this.snackBar.open('La categoría no tiene un almacén válido. Corrige su configuración.', 'Cerrar', { duration: 4500 });
      return;
    }
    const identity = this.identityForm.getRawValue();
    const logistics = this.logisticsForm.getRawValue();
    const finance = this.financeForm.getRawValue();
    const mode = this.currentTrackingMode === 'Serializado' ? 1 :
      this.currentTrackingMode === 'A Granel' ? 2 : 0;
    const code = String(identity.sku || identity.barcode || identity.serialNumber || '').trim();
    if (!code) {
      this.snackBar.open('Ingresa SKU, código de barras o número de serie.', 'Cerrar', { duration: 4000 });
      return;
    }
    const attrs: Record<string, string> = {};
    for (let i = 1; i <= 6; i++) attrs[`attr${i}`] = String(identity[`attr${i}`] ?? '').trim();
    const detail: ArticleDetail = {
      serialNumber: String(identity.serialNumber ?? '').trim(),
      attr1: attrs['attr1'], attr2: attrs['attr2'], attr3: attrs['attr3'],
      attr4: attrs['attr4'], attr5: attrs['attr5'], attr6: attrs['attr6'], isActive: true
    };
    // Alta serializada: una serie única, no vacía, por cada unidad de stock.
    // WEBINVENTORY_UNIDADES_INGRESOS_2026_V1: validaciones finales al guardar.
    const purchaseName = String(logistics.acqUnit ?? '');
    const saleName = String(logistics.saleUnit ?? '');
    const converted = isUnitConversion(purchaseName, saleName);
    const physical = isMeasuredUnit(purchaseName);
    if (this.isEditMode && this.existingArticle && Number(this.existingArticle.stock) > 0 &&
        saleName !== String(this.existingArticle.saleUnit ?? this.existingArticle.measurementUnit)) {
      this.currentStep = 2;
      this.snackBar.open('No cambies la unidad de stock de un artículo con existencias.', 'Cerrar', {duration:6000});
      return;
    }
    const configurationValid = this.unidades.includes(purchaseName) &&
      (physical ? purchaseName === saleName : (purchaseName === saleName || converted)) &&
      (converted ? validPieces(logistics.initialQuantity, mode === 1) &&
        validPieces(logistics.conversionFactor, true) : true);
    const quantityValid = validQuantity(logistics.stock, saleName, mode === 1);
    if (!configurationValid || !quantityValid) {
      this.currentStep = 2;
      this.snackBar.open('Revisa unidades, cantidades y equivalencias en Logística.', 'Cerrar', {duration:5000});
      return;
    }
    const requestedStock = Number(logistics.stock);
    const initialSerials = mode === 1 && !this.isEditMode
      ? [String(identity.serialNumber ?? ''), ...this.extraSerialNumbers.slice(0, Math.max(0, requestedStock - 1))]
          .map(value => String(value ?? '').trim()) : [];
    if (mode === 1 && !this.isEditMode) {
      const unique = new Set(initialSerials.map(value => value.toLocaleUpperCase('es-PE')));
      if (!Number.isInteger(requestedStock) || requestedStock < 1 || requestedStock > 1000 ||
          initialSerials.length !== requestedStock || initialSerials.some(value => !value || value.length > 150) ||
          unique.size !== requestedStock) {
        this.currentStep = 2;
        this.snackBar.open('El stock serializado requiere exactamente una serie válida y distinta por unidad.', 'Cerrar', { duration: 6500 });
        return;
      }
    }
    const targetInventoryId = this.existingArticle?.inventoryId ?? this.inventoryContext.activeInventoryId;
    if (!targetInventoryId) {
      this.snackBar.open('Selecciona un inventario de trabajo antes de registrar artículos.', 'Cerrar', { duration: 5000 });
      return;
    }
    const payload: Partial<Article> & { id: number } = {
      id: this.existingArticle?.id ?? 0,
      inventoryId: Number(targetInventoryId), categoryId: Number(category.id),
      brandId: Number(identity.brandId), code, barcode: identity.barcode || null,
      name: String(identity.name).trim(), model: identity.model || 'Sin modelo',
      presentation: identity.presentation || null, serialNumber: identity.serialNumber || null,
      tracking: mode, stock: requestedStock,
      measurementUnit: logistics.saleUnit,
      acquisitionUnit: logistics.acqUnit, saleUnit: logistics.saleUnit,
      conversionFactor: Number(logistics.conversionFactor),
      acquisitionPrice: finance.acqPrice == null ? null : Number(finance.acqPrice),
      acquisitionCurrency: finance.acqCurrency,
      salePrice: finance.salePrice == null ? null : Number(finance.salePrice),
      saleCurrency: finance.saleCurrency,
      characteristics: mode === 1 ? null : JSON.stringify(attrs),
      details: mode === 1
        ? (this.isEditMode
            ? (this.hasSeveralExistingSerials ? [] : [{ ...detail, ...(this.existingArticle?.details?.[0]?.id
                ? {id: this.existingArticle.details[0].id, articleId: this.existingArticle.id} : {}) }])
            : initialSerials.map(serialNumber => ({...detail, serialNumber})))
        : undefined,
      actionId: this.existingArticle?.actionId ?? 1,
      isActive: this.existingArticle?.isActive ?? true,
      companyId: this.existingArticle?.companyId ?? 0,
      registrationDate: this.existingArticle?.registrationDate
    };
    this.isSaving = true;
    const request$: Observable<Article | void> = this.isEditMode
      ? this.articleService.updateArticle(payload)
      : this.articleService.createArticle(payload);
    request$.subscribe({
      next: (saved: Article | void) => {
        const articleId = this.existingArticle?.id ?? (saved as Article | undefined)?.id;
        if (!articleId) {
          this.isSaving = false;
          this.snackBar.open('El servidor no devolvió el ID del artículo.', 'Cerrar', {duration: 5000});
          return;
        }
        const mediaOperations: Observable<unknown>[] = [];
        if (this.mainPhotoFile || this.voucherFile)
          mediaOperations.push(this.articleService.uploadMedia(articleId, this.mainPhotoFile, this.voucherFile));
        if (this.removedPhoto && !this.mainPhotoFile)
          mediaOperations.push(this.articleService.deleteMedia(articleId, 'photo'));
        if (this.removedVoucher && !this.voucherFile)
          mediaOperations.push(this.articleService.deleteMedia(articleId, 'voucher'));
        (mediaOperations.length ? forkJoin(mediaOperations) : of([])).subscribe({
          next: () => {
            this.isSaving = false;
            this.snackBar.open('Artículo y archivos guardados correctamente.', 'Cerrar', { duration: 3300 });
            this.dialogRef.close({ created: !this.isEditMode, tracking: mode, articleId });
          },
          error: (error: HttpErrorResponse) => {
            this.isSaving = false;
            this.snackBar.open(`Artículo guardado, pero falló el archivo: ${this.readApiError(error)}`, 'Cerrar', { duration: 8500 });
            this.dialogRef.close({ created: !this.isEditMode, tracking: mode, articleId });
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.snackBar.open(this.readApiError(error), 'Cerrar', { duration: 7500 });
      }
    });
  }

  private readApiError(error: HttpErrorResponse): string {
    const body = error.error;
    if (typeof body === 'string') return body.slice(0, 260);
    return String(body?.error ?? body?.title ?? body?.message ?? `HTTP ${error.status}`);
  }
}

/* WEBINVENTORY_UNIDADES_INGRESOS_2026_V1: articleTs */
