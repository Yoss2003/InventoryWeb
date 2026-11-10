import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../../../shared/toast/toast.service';
import { CatalogSimilarDialogComponent, CatalogSimilarChoice } from '../../../shared/catalog-similar-dialog/catalog-similar-dialog';
import { CommonModule } from '@angular/common';
import { InventoryDialogMotionDirective } from '../../../shared/ui/inv-dialog-motion.directive';
import { CategoryService } from '../services/category';
import { Category } from '../../../core/models/category.model';
import { FormControl } from '@angular/forms';
import type { Observable } from 'rxjs';
import { CategoryUnitPickerDialogComponent } from './category-unit-picker-dialog';
import {MeasurementUnitsService, MeasurementUnit} from '../../../core/services/measurement-units';

@Component({
    selector: 'app-category-child-form',
    standalone: true,
    imports: [
        ReactiveFormsModule, MatInputModule, MatButtonModule, MatDialogModule,
        MatSelectModule, MatStepperModule, MatSlideToggleModule, MatCheckboxModule,
        MatIconModule, MatTooltipModule, CommonModule, InventoryDialogMotionDirective
    ],
    templateUrl: './category-child-form.html',
    styleUrl: './category-child-form.scss'
})
export class CategoryChildFormComponent implements OnInit {
    private originalEditSnapshot = '';
    private fb = inject(FormBuilder);
    private categoryService = inject(CategoryService);
    private snackBar = inject(MatSnackBar);
    private readonly toast = inject(ToastService);
    private readonly dialogs = inject(MatDialog);
    public dialogRef = inject(MatDialogRef<CategoryChildFormComponent>);
    public data: { categoriaEdit?: Category, padres: Category[] } = inject(MAT_DIALOG_DATA);
    private readonly measurementUnitsService = inject(MeasurementUnitsService);
    unidadesDisponibles: MeasurementUnit[] = [];
    cargandoUnidades = false;
    showPreviewInputs = false;
    previewControls: { [key: string]: FormControl } = {};

    isEdit = false;
    padres: Category[] = [];

    identityForm: FormGroup;
    rulesForm: FormGroup;
    attributesForm: FormGroup;

    trackingOptions = [
        { label: 'Serializado', value: 'Serializado' },
        { label: 'Estándar', value: 'Estándar' },
        { label: 'A Granel', value: 'A Granel' }
    ];
    namingOptions = ['Código + Modelo', 'Solo Empaque', 'Nombre'];

    // Control de respaldo para la auto-corrección de fórmulas (similar a MAUI)
    private formulaBackup = '';
    private previousAttributeNames: string[] = Array(6).fill('');

    constructor() {
        this.identityForm = this.fb.group({
            id: [0],
            name: ['', Validators.required],
            description: [''],
            parentCategoryId: [null, Validators.required]
        });

        this.rulesForm = this.fb.group({
            trackingMode: ['Estándar', Validators.required],
            isReturnable: [false],
            namingMethod: ['Nombre'],
            isNamingLibre: [false],
            selectedUnitIds: [[], Validators.required]
        });

        this.attributesForm = this.fb.group({
            namingCustom: [''],
            label1: [''], isUnique1: [false],
            label2: [''], isUnique2: [false],
            label3: [''], isUnique3: [false],
            label4: [''], isUnique4: [false],
            label5: [''], isUnique5: [false],
            label6: [''], isUnique6: [false],
        });
    }

    readonly formulaTagEnabled: boolean[] = Array(6).fill(false);

    // La primera apertura no anima desde el ancho inicial de la ventana.
    private categoryWidthAnimationReady = false;

    categoryMotionStep = 0;

    setDialogWidth(step: number): void {
        this.categoryMotionStep = step;
        const width = step === 2 && this.showAttributesStep
            ? 'min(1100px, calc(100vw - 32px))'
            : 'min(700px, calc(100vw - 32px))';
        this.dialogRef.updateSize(width);
        if (!this.categoryWidthAnimationReady) {
            this.dialogRef.addPanelClass('inv-category-width-transition');
            this.categoryWidthAnimationReady = true;
        }
    }

    cargarUnidades(): void {
    this.cargandoUnidades = true;

    this.measurementUnitsService.getAll().subscribe({
        next: (unidades) => {
        this.unidadesDisponibles = unidades;
        this.cargandoUnidades = false;
        },
        error: () => {
        this.cargandoUnidades = false;
        this.toast.error('No se pudieron cargar las unidades de medida.');
        }
    });
    }


    isFormulaTagEnabled(i: number): boolean {
        return Boolean(
            this.formulaTagEnabled[i - 1] &&
            String(this.attributesForm.get('label' + i)?.value ?? '').trim() &&
            !this.hasDuplicateAttributeName(i)
        );
    }

    setFormulaTagEnabled(i: number, enabled: boolean): void {
        const label = String(this.attributesForm.get('label' + i)?.value ?? '').trim();
        const allowed = Boolean(enabled && label && !this.hasDuplicateAttributeName(i));
        this.formulaTagEnabled[i - 1] = allowed;
        if (!allowed && label && this.getTagStatus(label) === 'active') {
            this.toggleTag('[' + label + ']');
        }
    }

    /** En el campo solo aparecen abreviaturas, sin paréntesis ni espacios de la BD. */
    get selectedUnitAbbreviations(): string {
        const ids = (this.rulesForm?.get('selectedUnitIds')?.value ?? []) as number[];
        if (!ids.length) return 'Seleccionar unidades';
        return ids.map(id => {
            const unit = this.unidadesDisponibles.find(u => Number(u.id) === Number(id));
            return unit ? String(unit.abbreviation || unit.unitName).trim() : String(id);
        }).join(', ');
    }

    openUnitPicker(): void {
        if (this.cargandoUnidades || !this.unidadesDisponibles.length) return;
        const selectedIds = (this.rulesForm.get('selectedUnitIds')?.value ?? []) as number[];
        this.dialogs.open(CategoryUnitPickerDialogComponent, {
            width: 'min(590px, calc(100vw - 24px))',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100dvh - 24px)',
            autoFocus: false,
            data: { units: this.unidadesDisponibles, selectedIds }
        }).afterClosed().subscribe((ids: number[] | undefined) => {
            if (!Array.isArray(ids)) return;
            const control = this.rulesForm.get('selectedUnitIds');
            control?.setValue(ids);
            control?.markAsDirty();
            control?.markAsTouched();
        });
    }

    ngOnInit() {
        this.setDialogWidth(0);
        this.cargarUnidades();
        this.padres = this.data.padres || [];

        if (this.data.categoriaEdit) {
            this.isEdit = true;
            const cat = this.data.categoriaEdit;

            this.identityForm.patchValue({
                id: cat.id,
                name: cat.name,
                description: cat.description,
                parentCategoryId: cat.parentCategoryId
            });

            let tMode = cat.trackingMode;
            if (tMode === 'Serialized') tMode = 'Serializado';
            else if (tMode === 'Standard') tMode = 'Estándar';
            else if (tMode === 'Bulk') tMode = 'A Granel';

            let isLibre = false;
            let namingMethod = cat.namingMethod;
            let namingCustom = '';

            if (namingMethod && !this.namingOptions.includes(namingMethod) && tMode !== 'A Granel') {
                isLibre = true;
                namingCustom = namingMethod;
                this.formulaBackup = namingMethod;
            }

            this.rulesForm.patchValue({
                trackingMode: tMode || 'Estándar',
                isReturnable: cat.isReturnable ?? false,
                namingMethod: isLibre ? 'Nombre' : (namingMethod || 'Nombre'),
                isNamingLibre: isLibre,
                selectedUnitIds: cat.selectedUnitIds || []
            });

            this.attributesForm.patchValue({
                namingCustom: namingCustom,
                label1: cat.label1 || '', isUnique1: cat.isUnique1 ?? false,
                label2: cat.label2 || '', isUnique2: cat.isUnique2 ?? false,
                label3: cat.label3 || '', isUnique3: cat.isUnique3 ?? false,
                label4: cat.label4 || '', isUnique4: cat.isUnique4 ?? false,
                label5: cat.label5 || '', isUnique5: cat.isUnique5 ?? false,
                label6: cat.label6 || '', isUnique6: cat.isUnique6 ?? false,
            });
        }

        // Sincronizar respaldo al cambiar de modo libre
        this.rulesForm.get('isNamingLibre')?.valueChanges.subscribe(isLibre => {
            if (isLibre && !this.formulaBackup) {
                this.formulaBackup = '[Marca]';
                this.attributesForm.get('namingCustom')?.setValue('[Marca]');
            }
        });
        this.initializeAttributeLabels();
        this.originalEditSnapshot = this.getEditSnapshot();

        for (let i = 1; i <= 6; i++) {
            const label = String(this.attributesForm.get('label' + i)?.value ?? '').trim();
            this.formulaTagEnabled[i - 1] = Boolean(label && this.getTagStatus(label) === 'active');
        }
    }


    /** Sin espacios ni saltos de linea en fórmulas y etiquetas: usar _ manualmente. */

    /** Elimina espacios dentro de [etiqueta] y limita a uno alrededor de operadores. */
    private normalizeFormula(value: string): string {
        const raw = String(value ?? '');
        const blocks = raw.match(/\[[^\]]*\]|[^\[\]]+|\[|\]/gu) ?? [];
        return blocks.map(block => {
            if (block.startsWith('[') && block.endsWith(']')) {
                return '[' + block.slice(1, -1).replace(/\s+/gu, '') + ']';
            }
            return block.replace(/\s*([+|/,.;:\-])\s*/gu, ' $1 ')
                .replace(/\s{2,}/gu, ' ');
        }).join('').replace(/\s{2,}/gu, ' ').trim();
    }

    private normalizeAttributeLabel(value: string): string {
        return String(value ?? '').replace(/\s+/gu, '');
    }

    private availableLabels(): string[] {
        return Array.from({ length: 6 }, (_, index) =>
            String(this.attributesForm.get('label' + (index + 1))?.value ?? '').trim()
        ).filter(Boolean);
    }

    get attributeTags(): string[] {
        return [...new Set(this.availableLabels())];
    }

    private knownTagNames(): Set<string> {
        return new Set(
            ['Marca', 'Código', 'Serie', 'Modelo', 'Pres.', ...this.availableLabels()]
                .map(name => name.toLocaleLowerCase('es'))
        );
    }


    private cleanConnectors(formula: string): string {
        return this.normalizeFormula(
            this.normalizeFormula(formula)
                .replace(/\s*([+|/,.;:\-])(?:\s*[+|/,.;:\-])+\s*/gu, ' $1 ')
                .replace(/^\s*[+|/,.;:\-]+\s*|\s*[+|/,.;:\-]+\s*$/gu, '')
        );
    }

    private initializeAttributeLabels(): void {
        for (let i = 1; i <= 6; i++) {
            const control = this.attributesForm.get('label' + i);
            if (!control) continue;
            const cleaned = this.normalizeAttributeLabel(String(control.value ?? ''));
            control.setValue(cleaned, { emitEvent: false });
            this.previousAttributeNames[i - 1] = cleaned;
            const unique = this.attributesForm.get('isUnique' + i);
            if (!cleaned) {
                unique?.setValue(false, { emitEvent: false });
                unique?.disable({ emitEvent: false });
            } else {
                unique?.enable({ emitEvent: false });
            }
        }
        const formulaControl = this.attributesForm.get('namingCustom');
        const formula = this.normalizeFormula(String(formulaControl?.value ?? ''));
        formulaControl?.setValue(formula, { emitEvent: false });
        this.formulaBackup = formula;
    }

    private getEditSnapshot(): string {
        const identity = this.identityForm.getRawValue();
        const rules = this.rulesForm.getRawValue();
        const attrs = this.attributesForm.getRawValue();
        const naming = !this.isTrackingConfigurable ? 'Nombre'
            : rules.isNamingLibre
                ? this.normalizeFormula(String(attrs.namingCustom ?? ''))
                : String(rules.namingMethod ?? '');
        const units: number[] = Array.isArray(rules.selectedUnitIds)
            ? rules.selectedUnitIds.map(Number).sort((a: number, b: number) => a - b)
            : [];
        return JSON.stringify({
            name: String(identity.name ?? '').trim(),
            description: String(identity.description ?? '').trim(),
            parentCategoryId: identity.parentCategoryId == null ? null : Number(identity.parentCategoryId),
            trackingMode: rules.trackingMode,
            isReturnable: Boolean(rules.isReturnable),
            naming,
            units,
            attributes: [1, 2, 3, 4, 5, 6].map(i => ({
                name: this.normalizeAttributeLabel(String(attrs['label' + i] ?? '')),
                isUnique: Boolean(attrs['isUnique' + i])
            }))
        });
    }

    get hasEditChanges(): boolean {
        return !this.isEdit || this.getEditSnapshot() !== this.originalEditSnapshot;
    }

    /** Renombra el token ya seleccionado, sin cambiar su estado ni sus conectores. */
    onAttributeLabelInput(i: number): void {
        const control = this.attributesForm.get('label' + i);
        if (!control) return;
        const cleaned = this.normalizeAttributeLabel(String(control.value ?? ''));
        if (control.value !== cleaned) control.setValue(cleaned, { emitEvent: false });

        const previous = this.previousAttributeNames[i - 1] ?? '';
        if (previous && previous !== cleaned) {
            const formulaCtrl = this.attributesForm.get('namingCustom');
            const currentFormula = String(formulaCtrl?.value ?? '');
            const updatedFormula = currentFormula.replace(/\[([^\]]+)\]/g, (whole, name: string) =>
                name.toLocaleLowerCase('es') === previous.toLocaleLowerCase('es')
                    ? (cleaned ? '[' + cleaned + ']' : '')
                    : whole
            );
            if (currentFormula !== updatedFormula) {
                const nextFormula = cleaned ? updatedFormula : this.cleanConnectors(updatedFormula);
                formulaCtrl?.setValue(nextFormula, { emitEvent: false });
                this.formulaBackup = nextFormula;
            }
        }
        this.previousAttributeNames[i - 1] = cleaned;
        if (!cleaned) this.formulaTagEnabled[i - 1] = false;
        const unique = this.attributesForm.get('isUnique' + i);
        if (!cleaned) {
            unique?.setValue(false, { emitEvent: false });
            unique?.disable({ emitEvent: false });
        } else {
            unique?.enable({ emitEvent: false });
        }
    }

    /** Elimina espacios al teclear, sin desplazar el cursor innecesariamente. */
    onNamingInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        const original = input.value;
        const cleaned = this.normalizeFormula(original);
        if (original === cleaned) return;
        const beforeCaret = this.normalizeFormula(original.slice(0, input.selectionStart ?? original.length));
        this.attributesForm.get('namingCustom')?.setValue(cleaned, { emitEvent: false });
        input.value = cleaned;
        input.setSelectionRange(beforeCaret.length, beforeCaret.length);
    }


    private formulaIsValid(formula: string): boolean {
        const normalized = this.normalizeFormula(formula);
        if (!normalized || /\s{2,}/u.test(normalized)) return false;
        if (/[^\p{L}\p{N}\[\]+|\/,. ;:_\-]/u.test(normalized)) return false;
        const matches = [...normalized.matchAll(/\[([^\]]+)\]/gu)];
        if (!matches.length || matches.some(m => /\s/u.test(m[1]))) return false;
        const names = this.knownTagNames();
        if (matches.some(m => !names.has(m[1].toLocaleLowerCase('es')))) return false;
        // Solo se permiten etiquetas, conectores y 0-1 espacios junto a cada conector.
        const extras = normalized.split(/\[[^\]]+\]/gu);
        return extras.every((part, index) =>
            part === '' || (index > 0 && index < extras.length - 1 &&
                /^ ?[+|\/,.;:\-] ?$/u.test(part))
        );
    }

    get isTrackingConfigurable(): boolean {
        const mode = this.rulesForm.get('trackingMode')?.value;
        return mode !== 'A Granel' && mode !== 'Bulk';
    }

    get showAttributesStep(): boolean {
        const mode = this.rulesForm.get('trackingMode')?.value;
        return mode === 'Serializado' || mode === 'Estándar' || mode === 'Serialized' || mode === 'Standard';
    }

    // Validación para habilitar el botón Guardar
    get isFormComplete(): boolean {
        const name = String(this.identityForm.get('name')?.value ?? '').trim();
        const parentId = this.identityForm.get('parentCategoryId')?.value;
        const mode = this.rulesForm.get('trackingMode')?.value;

        if (!name || !parentId || !mode || this.identityForm.invalid || this.rulesForm.invalid) {
            return false;
        }
        if ([1, 2, 3, 4, 5, 6].some(i => this.hasDuplicateAttributeName(i))) {
            return false;
        }
        if (!this.isTrackingConfigurable) return true;

        if (!this.rulesForm.get('isNamingLibre')?.value) {
            return Boolean(this.rulesForm.get('namingMethod')?.value);
        }

        const formula = this.normalizeFormula(
            String(this.attributesForm.get('namingCustom')?.value ?? '')
        );
        const uniqueTags = new Set(this.getActiveTags().map(tag => tag.toLocaleLowerCase('es')));
        return this.formulaIsValid(formula) && uniqueTags.size >= 2;
    }


    getActiveTags(): string[] {
        const formula = this.normalizeFormula(String(this.attributesForm.get('namingCustom')?.value ?? ''));
        const tags = formula.match(/\[[^\]]+\]/g) ?? [];
        return [...new Set(tags)];
    }

    // Obtiene (o crea) el FormControl para un valor de prueba
    getPreviewControl(tag: string): FormControl {
        // Usamos .controls en lugar de .get() para evitar que Angular rompa la key por el punto de [Pres.]
        if (!this.previewControls[tag]) {
            let defaultVal = '';
            this.previewControls[tag] = new FormControl(defaultVal);
        }
        return this.previewControls[tag];
    }

    // Restricción: Evitar adiciones infinitas de la misma etiqueta
    toggleTag(tag: string) {
        const label = tag.slice(1, -1).toLocaleLowerCase('es');
        let formula = this.normalizeFormula(String(this.attributesForm.get('namingCustom')?.value ?? ''));
        const present = this.getActiveTags().some(t => t.slice(1, -1).toLocaleLowerCase('es') === label);
        if (present) {
            formula = this.cleanConnectors(formula.replace(/\[([^\]]+)\]/gu,
                (whole, name: string) => name.toLocaleLowerCase('es') === label ? '' : whole
            ));
        } else {
            formula = this.normalizeFormula(formula + (formula ? ' + ' : '') + tag);
        }
        this.formulaBackup = formula;
        this.attributesForm.get('namingCustom')?.setValue(formula);
    }

    // Preview del nombre
    /* FASE 4.1 */
    get formulaPreview(): string {
        let formula = this.attributesForm.get('namingCustom')?.value || '';
        if (!formula) return 'Define una fórmula para ver el ejemplo...';

        const activeTags = this.getActiveTags();

        for (const tag of activeTags) {
            // Acceso directo al control para evitar fallos con el punto
            const control = this.previewControls[tag];
            const val = control ? control.value : tag;

            // Si el campo está vacío, mostramos la etiqueta original para que no desaparezca
            const displayVal = val ? val : tag;

            const escapedTag = tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            formula = formula.replace(new RegExp(escapedTag, 'g'), displayVal);
        }

        // '+' es concatenación de etiquetas, no un separador visible en el nombre.
        return formula.replace(/\s*\+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    // Respaldo al enfocar
    onNamingFocused() {
        this.formulaBackup = this.attributesForm.get('namingCustom')?.value || '';
    }

    // Auto-corrección al perder el foco (Validación estricta de símbolos permitidos y etiquetas alteradas)
    onNamingUnfocused() {
        const control = this.attributesForm.get('namingCustom');
        const formula = this.normalizeFormula(String(control?.value ?? ''));
        if (formula && !this.formulaIsValid(formula)) {
            this.snackBar.open(
                'Revisa las etiquetas y los separadores. No uses espacios dentro de [etiqueta]; usa _ para nombres compuestos.',
                'Cerrar', { duration: 4200 }
            );
            control?.setValue(this.formulaBackup);
            return;
        }
        control?.setValue(formula);
        this.formulaBackup = formula;
    }

    hasDuplicateAttributeName(index: number): boolean {
        const name = String(
            this.attributesForm.get('label' + index)?.value ?? ''
        ).trim().normalize('NFC').toLocaleLowerCase('es');

        if (!name) return false;

        return [1, 2, 3, 4, 5, 6].some(other =>
            other !== index &&
            String(this.attributesForm.get('label' + other)?.value ?? '')
                .trim().normalize('NFC').toLocaleLowerCase('es') === name
        );
    }

    private autoCorregirFormula(input: string): string {
        return this.normalizeFormula(input);
    }

    // Determinar color de estado del botón de etiqueta (Verde = Activo, Amarillo = Modificado/Incompleto)
    getTagStatus(tag: string): 'active' | 'warning' | 'inactive' {
        const name = this.normalizeAttributeLabel(tag).toLocaleLowerCase('es');
        return this.getActiveTags().some(active =>
            active.slice(1, -1).toLocaleLowerCase('es') === name
        ) ? 'active' : 'inactive';
    }

    onSubmit() {
        if (!this.isFormComplete || !this.hasEditChanges) return;
        const rules = this.rulesForm.getRawValue();
        const attrs = this.attributesForm.getRawValue();
        const finalNaming = rules.isNamingLibre ? this.normalizeFormula(String(attrs.namingCustom ?? '')) : rules.namingMethod;
        const payload: Category = {
            ...this.data.categoriaEdit,
            ...this.identityForm.value,
            ...attrs,
            trackingMode: rules.trackingMode,
            isReturnable: rules.isReturnable,
            namingMethod: finalNaming,
            selectedUnitIds: rules.selectedUnitIds,
            inventoryId: this.data.categoriaEdit?.inventoryId ??
                this.padres.find(p => p.id === Number(this.identityForm.get('parentCategoryId')?.value))?.inventoryId ?? 0,
            isActive: this.data.categoriaEdit?.isActive ?? true,
            companyId: this.data.categoriaEdit?.companyId ?? 0
        };
        this.saveCategory(payload,false);
    }

    private saveCategory(payload:Category,allowSimilar:boolean):void {
        const request$: Observable<unknown> = this.isEdit
          ? this.categoryService.updateCategory(payload)
          : this.categoryService.createCategory(payload,allowSimilar);
        request$.subscribe({
            next: result => {
                const saved = result as Category | undefined;
                if (!this.isEdit && saved?.reused) this.toast.info(`Se reutilizó la categoría «${saved.name}».`,'Categoría existente');
                else this.toast.success(`Categoría ${this.isEdit ? 'actualizada' : 'creada'} con éxito`);
                this.dialogRef.close(true);
            },
            error: (error:HttpErrorResponse) => {
                if (!this.isEdit && error.status===409 && error.error?.code==='similar_name') {
                    this.toast.warning('Encontramos subcategorías parecidas.','Posible duplicado');
                    this.dialogs.open(CatalogSimilarDialogComponent, {data:{type:'subcategorías',enteredName:payload.name,matches:error.error?.matches||[]},width:'min(500px,calc(100vw - 24px))'})
                      .afterClosed().subscribe((choice:CatalogSimilarChoice | undefined) => {
                        if(choice?.action==='create')this.saveCategory(payload,true);
                        else if(choice?.action==='reuse'){this.toast.info('Se utilizará la subcategoría existente.');this.dialogRef.close(true);}
                      });
                } else { this.toast.error(String(error?.error?.error || 'Error al guardar categoría')); }
            }
        });
    }
}

/* WEBINVENTORY_UNIDADES_INGRESOS_2026_V1: categoryTs */

/* WEBINVENTORY_UNIDADES_UX_V1 */
/* WEBINV_CATEGORIA_VISUAL_2026_V1 */
