import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BrowserMultiFormatReader } from '@zxing/browser';

import { CategoryService } from '../../categories/services/category';
import { BrandService } from '../../../core/services/brands';
import { Brand } from '../../../core/models/brand.model';
import { BrandDialogComponent, BrandDialogData } from '../brand-dialog/brand-dialog';

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
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
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
  unidades = ['Unidad', 'Caja', 'Metros', 'Kilos', 'Gramos', 'Litros'];

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

  currentStep = 1;
  activeSubTab: 'general' | 'attributes' | 'images' = 'general';
  attemptedNext = false;
  attemptedLogistics = false;
  attemptedSave = false;

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;
    this.initForms();
    this.setupSubscriptions();
    this.loadCatalogs();
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
    return (this.attemptedNext || !!this.identityForm.get('name')?.touched) &&
      !String(this.identityForm.get('name')?.value ?? '').trim();
  }

  isInvalid(section: 'identity' | 'logistics' | 'finance', name: string): boolean {
    const form = section === 'identity' ? this.identityForm :
      section === 'logistics' ? this.logisticsForm : this.financeForm;
    const control = form?.get(name);
    if (!control) return false;
    const wasSubmitted = section === 'identity' ? this.attemptedNext :
      section === 'logistics' ? this.attemptedLogistics : this.attemptedSave;
    return !!control.invalid && (control.touched || wasSubmitted);
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
    this.logisticsForm.get('conversionFactor')?.valueChanges.subscribe(() => this.calculateProfit());
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
        this.logisticsForm.get('stock')?.setValue(1);
        this.logisticsForm.get('stock')?.disable({ emitEvent: false });
      } else {
        if (this.currentTrackingMode === 'A Granel') sku?.setValidators(Validators.required);
        else barcode?.setValidators(Validators.required);
        this.logisticsForm.get('stock')?.enable({ emitEvent: false });
      }
    }

    [barcode, sku, serial].forEach(control => control?.updateValueAndValidity({ emitEvent: false }));
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
    // El administrador cambia el catálogo, pero no selecciona automáticamente una marca.
    dialogRef.afterClosed().subscribe((changed?: boolean) => {
      if (changed) this.loadBrands(undefined, true);
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
    this.mainPhotoFile = file;
    this.photoObjectUrl = URL.createObjectURL(file);
    this.mainPhotoPreview = this.photoObjectUrl;
    this.cdr.markForCheck();
  }

  private setVoucherFile(file: File, isPdf: boolean): void {
    if (this.mediaPreviewKind === 'voucher') this.closeMediaPreview();
    this.releaseObjectUrl('voucher');
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
    } else {
      this.releaseObjectUrl('voucher');
      this.voucherFile = null;
      this.voucherPreview = null;
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
    const factor = Number(this.logisticsForm.get('conversionFactor')?.value);

    if (!(acquisition > 0) || !(sale > 0) || !(factor > 0) || this.financeForm.invalid) {
      this.hasFinancialEstimate = false;
      this.utilityPerUnit = 0;
      this.marginPercent = 0;
      this.profitabilityRatio = 0;
      this.isLoss = false;
      return;
    }

    const acqRate = this.monedas.find(m => m.code === this.financeForm.get('acqCurrency')?.value)?.rate ?? 1;
    const saleRate = this.monedas.find(m => m.code === this.financeForm.get('saleCurrency')?.value)?.rate ?? 1;
    const costSolesPerUnit = acquisition * acqRate / factor;
    const saleSolesPerUnit = sale * saleRate;

    this.utilityPerUnit = saleSolesPerUnit - costSolesPerUnit;
    this.marginPercent = (this.utilityPerUnit / costSolesPerUnit) * 100;
    this.profitabilityRatio = saleSolesPerUnit / costSolesPerUnit;
    this.isLoss = this.utilityPerUnit < 0;
    this.hasFinancialEstimate = true;
  }

  onSubmit(): void {
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

    // Datos del formulario verificados. Se conserva la estructura del payload original.
    const payload = {
      ...this.identityForm.getRawValue(),
      ...this.logisticsForm.getRawValue(),
      ...this.financeForm.getRawValue(),
      companyId: 1,
      inventoryId: 1,
      isActive: true
    };

    // IMPORTANTE: el onSubmit() original no llamaba a ArticleService;
    // mostraba un mensaje de guardado simulado y cerraba el diálogo.
    // No se finge éxito ni se cierra el diálogo hasta conectar el método real de API.
    // Al integrar ArticleService, usar `payload`, mainPhotoFile y voucherFile
    // según el contrato real del endpoint, y cerrar solo en el callback de éxito.
    void payload;
    this.snackBar.open('Formulario válido. Falta conectar el guardado real con ArticleService.', 'Cerrar', {
      duration: 5500
    });
  }
}
