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
import { CommonModule } from '@angular/common';
import { CategoryService } from '../services/category';
import { Category } from '../../../core/models/category.model';
import { FormControl } from '@angular/forms';

@Component({
    selector: 'app-category-child-form',
    standalone: true,
    imports: [
        ReactiveFormsModule, MatInputModule, MatButtonModule, MatDialogModule,
        MatSelectModule, MatStepperModule, MatSlideToggleModule, MatCheckboxModule,
        MatIconModule, MatTooltipModule, CommonModule
    ],
    templateUrl: './category-child-form.html',
    styleUrl: './category-child-form.scss'
})
export class CategoryChildFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private categoryService = inject(CategoryService);
    private snackBar = inject(MatSnackBar);
    public dialogRef = inject(MatDialogRef<CategoryChildFormComponent>);
    public data: { categoriaEdit?: Category, padres: Category[] } = inject(MAT_DIALOG_DATA);
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
            selectedUnitIds: [[]]
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

    ngOnInit() {
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
        if (this.identityForm.invalid || this.rulesForm.invalid) return false;

        const isLibre = this.rulesForm.get('isNamingLibre')?.value;
        const isGranel = !this.isTrackingConfigurable;

        if (isGranel) return true; // Granel usa por defecto "Nombre"

        if (isLibre) {
            const customVal = this.attributesForm.get('namingCustom')?.value || '';
            // Debe contener al menos una etiqueta entre corchetes [...]
            return /\[.*?\]/.test(customVal);
        }

        return true;
    }

    getActiveTags(): string[] {
        const formula = this.attributesForm.get('namingCustom')?.value || '';
        const tags = formula.match(/\[(.*?)\]/g) || [];
        return [...new Set<string>(tags)];
    }

    // Obtiene (o crea) el FormControl para un valor de prueba
    getPreviewControl(tag: string): FormControl {
        // Usamos .controls en lugar de .get() para evitar que Angular rompa la key por el punto de [Pres.]
        if (!this.previewControls[tag]) {
            let defaultVal = '';
            if(tag === '[Marca]') defaultVal = 'Lenovo';
            if(tag === '[Código]') defaultVal = 'LAP-001';
            this.previewControls[tag] = new FormControl(defaultVal);
        }
        return this.previewControls[tag];
    }

    // Restricción: Evitar adiciones infinitas de la misma etiqueta
    toggleTag(tag: string) {
        let currentVal = this.attributesForm.get('namingCustom')?.value || '';

        if (currentVal.includes(tag)) {
            // Eliminar la etiqueta y los operadores de suma sobrantes de forma limpia
            const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(\\s*\\+\\s*)?${escapedTag}(\\s*\\+\\s*)?`, 'g');

            currentVal = currentVal.replace(regex, (match: string, p1: string, p2: string) => {
                if (p1 && p2) return ' + ';
                return '';
            }).trim();

            // Limpieza adicional de conectores huérfanos al inicio o final
            currentVal = currentVal.replace(/^[\s+]+|[\s+]+$/g, '');
        } else {
            // Añadir al final con un separador ' + ' si ya hay contenido
            const separator = currentVal.length > 0 ? ' + ' : '';
            currentVal = currentVal + separator + tag;
        }

        this.formulaBackup = currentVal;
        this.attributesForm.get('namingCustom')?.setValue(currentVal);
    }

    // Preview del nombre
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

        return formula;
    }

    // Respaldo al enfocar
    onNamingFocused() {
        this.formulaBackup = this.attributesForm.get('namingCustom')?.value || '';
    }

    // Auto-corrección al perder el foco (Validación estricta de símbolos permitidos y etiquetas alteradas)
    onNamingUnfocused() {
        let inputVal = this.attributesForm.get('namingCustom')?.value || '';

        // Validar símbolos permitidos: / - + | _ , . ; : y letras/corchetes
        const invalidCharRegex = /[^A-Za-zÀ-ÿ0-9\[\]:\s+\-\|\/,.;_]/;
        if (invalidCharRegex.test(inputVal)) {
            this.snackBar.open('La fórmula contiene símbolos no permitidos. Solo se permiten / - + | _ , . ; :', 'Cerrar', { duration: 4000 });
            this.attributesForm.get('namingCustom')?.setValue(this.formulaBackup);
            return;
        }

        // Auto-corregir etiquetas incomutas (ej. [MARCA] escrito a medias como [CA])
        const corrected = this.autoCorregirFormula(inputVal);
        const finalVal = stringIsNullOrWhiteSpace(corrected) ? this.formulaBackup : corrected;

        this.attributesForm.get('namingCustom')?.setValue(finalVal);
        this.formulaBackup = finalVal;
    }

    private autoCorregirFormula(input: string): string {
        if (!this.formulaBackup) return input;

        // Extraer etiquetas esperadas del respaldo original
        const expectedTags = this.formulaBackup.match(/\[(.*?)\]/g) || [];
        let result = '';

        expectedTags.forEach((tag, index) => {
            if (index === 0) {
                result += tag;
            } else {
                result += ' + ' + tag;
            }
        });
        return result;
    }

    // Determinar color de estado del botón de etiqueta (Verde = Activo, Amarillo = Modificado/Incompleto)
    getTagStatus(tag: string): 'active' | 'warning' | 'inactive' {
        const currentVal = this.attributesForm.get('namingCustom')?.value || '';
        const baseTag = `[${tag}]`;

        if (currentVal.includes(baseTag)) return 'active';

        // Si contiene parte del texto pero fue alterado (ej. [Marc)
        const partialMatch = tag.toLowerCase().substring(1, 3);
        if (currentVal.toLowerCase().includes(partialMatch)) return 'warning';

        return 'inactive';
    }

    onSubmit() {
        if (!this.isFormComplete) return;

        const rules = this.rulesForm.getRawValue();
        const attrs = this.attributesForm.value;

        const finalNaming = rules.isNamingLibre ? attrs.namingCustom : rules.namingMethod;

        const payload: Category = {
            ...this.identityForm.value,
            ...this.attributesForm.value,
            trackingMode: rules.trackingMode,
            isReturnable: rules.isReturnable,
            namingMethod: finalNaming,
            selectedUnitIds: rules.selectedUnitIds,
            isActive: true,
            companyId: 1
        };

        this.categoryService.createCategory(payload).subscribe({
            next: () => {
                this.snackBar.open(`Categoría ${this.isEdit ? 'actualizada' : 'creada'} con éxito`, 'Cerrar', { duration: 3000 });
                this.dialogRef.close(true);
            },
            error: () => this.snackBar.open('Error al guardar categoría', 'Cerrar', { duration: 3000 })
        });
    }
}

function stringIsNullOrWhiteSpace(str: string | null): boolean {
    return !str || str.trim().length === 0;
}