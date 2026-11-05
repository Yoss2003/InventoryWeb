import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BrowserMultiFormatReader } from '@zxing/browser';

import { CategoryService } from '../../categories/services/category';

interface BrandOption {
  id: number;
  categoryId: number;
  name: string;
}

interface AttributeField {
  control: string;
  label: string;
}

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
  templateUrl: './article-form.html',
  styleUrls: ['./article-form.scss']
})
export class ArticleFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private snackBar = inject(MatSnackBar);
  public dialogRef = inject(MatDialogRef<ArticleFormComponent>);
  public data = inject(MAT_DIALOG_DATA, { optional: true });

  identityForm!: FormGroup;
  logisticsForm!: FormGroup;
  financeForm!: FormGroup;

  categoriasHijas: any[] = [];
  marcasGlobales: BrandOption[] = [];
  marcasFiltradas: BrandOption[] = [];
  unidades = ['Unidad', 'Caja', 'Metros', 'Kilos', 'Gramos', 'Litros'];

  // IMPORTANTE: cotización fija original, no es el tipo de cambio de hoy.
  monedas = [{ code: 'S/.', rate: 1 }, { code: 'USD', rate: 3.85 }];
  currentTrackingMode = '';

  utilityPerUnit = 0;
  marginPercent = 0; // Ganancia sobre costo, según cálculo original.
  profitabilityRatio = 0;
  isLoss = false;
  hasFinancialEstimate = false;

  mainPhotoPreview: string | ArrayBuffer | null = null;
  mainPhotoFile: File | null = null;
  voucherPreview: string | ArrayBuffer | null = null;
  voucherFile: File | null = null;
  isVoucherPdf = false;

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

  get attributeFields(): AttributeField[] {
    const category = this.selectedCategory;
    if (!category) return [];

    const fields: AttributeField[] = [];
    for (let i = 1; i <= 6; i++) {
      const label = category[`label${i}`];
      if (typeof label === 'string' && label.trim()) {
        fields.push({ control: `attr${i}`, label: label.trim() });
      }
    }
    return fields;
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
    this.categoryService.getCategories().subscribe({
      next: (cats) => {
        this.categoriasHijas = cats.filter(cat => cat.parentCategoryId != null && cat.isActive);
      },
      error: () => this.snackBar.open('No se pudieron cargar las categorías.', 'Cerrar', { duration: 3500 })
    });

    // Se conservan las marcas de prueba que venían en el archivo original.
    // Aún no están conectadas a un servicio real de marcas.
    this.marcasGlobales = [
      { id: 1, categoryId: 1, name: 'Lenovo' },
      { id: 2, categoryId: 1, name: 'HP' },
      { id: 3, categoryId: 2, name: 'CommScope' }
    ];
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
    this.currentStep = step;
    this.attemptedNext = false;
  }

  setSubTab(tab: 'general' | 'attributes' | 'images'): void {
    this.activeSubTab = tab;
  }

  goNextFromIdentity(): void {
    this.attemptedNext = true;
    this.identityForm.markAllAsTouched();
    if (!this.isIdentityComplete) {
      this.activeSubTab = 'general';
      this.snackBar.open('Completa los datos requeridos de Identidad.', 'Cerrar', { duration: 3200 });
      return;
    }
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
      this.currentTrackingMode = (mode === 'serialized' || mode === '1') ? 'Serializado'
        : (mode === 'bulk' || mode === '2') ? 'A Granel' : 'Estándar';

      this.marcasFiltradas = this.marcasGlobales.filter(brand =>
        Number(brand.categoryId) === Number(catId)
      );

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
    const catId = this.identityForm.get('categoryId')?.value;
    if (catId == null) {
      this.snackBar.open('Primero selecciona una categoría.', 'Cerrar', { duration: 3000 });
      return;
    }
    const nuevaMarca = prompt('Ingresa el nombre de la nueva marca:')?.trim();
    if (!nuevaMarca) return;
    const id = Math.max(0, ...this.marcasGlobales.map(m => m.id)) + 1;
    const brand = { id, categoryId: Number(catId), name: nuevaMarca };
    this.marcasGlobales.push(brand);
    this.marcasFiltradas = [...this.marcasFiltradas, brand];
    this.identityForm.get('brandId')?.setValue(id);
    this.snackBar.open('Marca añadida a este formulario (no guardada en el catálogo).', 'Cerrar', { duration: 3500 });
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

  onFileSelected(event: Event, type: 'photo' | 'voucher'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if ((type === 'photo' && !isImage) || (type === 'voucher' && !isImage && !isPdf)) {
      this.snackBar.open('Selecciona un archivo compatible.', 'Cerrar', { duration: 3000 });
      input.value = '';
      return;
    }
    if (type === 'photo') {
      this.mainPhotoFile = file;
      const reader = new FileReader();
      reader.onload = () => this.mainPhotoPreview = reader.result;
      reader.readAsDataURL(file);
    } else {
      this.voucherFile = file;
      this.isVoucherPdf = isPdf;
      if (isPdf) {
        this.voucherPreview = file.name;
      } else {
        const reader = new FileReader();
        reader.onload = () => this.voucherPreview = reader.result;
        reader.readAsDataURL(file);
      }
    }
  }

  removeFile(type: 'photo' | 'voucher'): void {
    if (type === 'photo') {
      this.mainPhotoFile = null;
      this.mainPhotoPreview = null;
    } else {
      this.voucherFile = null;
      this.voucherPreview = null;
      this.isVoucherPdf = false;
    }
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