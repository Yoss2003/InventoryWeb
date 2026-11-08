import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import type { Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../../../shared/toast/toast.service';
import { CatalogSimilarDialogComponent, CatalogSimilarChoice } from '../../../shared/catalog-similar-dialog/catalog-similar-dialog';
import { CategoryService } from '../services/category';
import { Category } from '../../../core/models/category.model';
import { InventoryService, InventorySummary } from '../../../core/services/inventories';
import { InventoryContextService } from '../../../core/services/inventory-context';
import { MatSelectModule } from '@angular/material/select';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

@Component({
  selector: 'app-category-parent-form', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatSelectModule, MatFormFieldModule, LoadingIndicatorComponent],
  templateUrl: './category-parent-form.html',styleUrl: './category-parent-form.scss'
})
export class CategoryParentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly inventoryService = inject(InventoryService);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(MatDialog);
  private readonly inventoryContext = inject(InventoryContextService);
  private readonly cdr = inject(ChangeDetectorRef);
  inventories: InventorySummary[] = [];
  readonly dialogRef = inject(MatDialogRef<CategoryParentFormComponent>);
  readonly data: Category | null = inject(MAT_DIALOG_DATA);
  isEdit = false;
  isSaving = false;
  loadingInventories = true;
  saveError = '';
  private originalSnapshot = '';
  readonly parentForm = this.fb.group({
    inventoryId: [null as number | null, Validators.required],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['']
  });
  ngOnInit(): void {
    this.isEdit = !!this.data?.id;
    if (this.data) this.parentForm.patchValue({inventoryId:this.data.inventoryId,name:this.data.name??'',description:this.data.description??''});
    this.originalSnapshot = this.formSnapshot();
    if (this.isEdit) this.parentForm.controls.inventoryId.disable({emitEvent:false});
    this.inventoryService.getInventories().subscribe({
      next: data => {
        this.inventories = data.filter(i => (i.isActive && !i.isMaster) || i.id === this.data?.inventoryId);
        const selected = this.inventoryContext.activeInventoryId;
        if (!this.isEdit && this.inventories.length) {
          const matched = this.inventories.find(i => i.id === selected) || this.inventories[0];
          this.parentForm.controls.inventoryId.setValue(matched.id);
        }
        this.loadingInventories = false;this.cdr.markForCheck();
      },
      error: () => {this.loadingInventories=false;this.saveError='No se pudieron consultar los inventarios. Comprueba la conexión con la API.';this.cdr.markForCheck();}
    });
  }
  private formSnapshot(): string {
    const value = this.parentForm.getRawValue();
    return JSON.stringify({inventoryId:value.inventoryId,name:String(value.name??'').trim(),description:String(value.description??'').trim()});
  }
  get hasChanges(): boolean {return !this.isEdit || this.formSnapshot() !== this.originalSnapshot;}
  get canSave(): boolean {
    return !this.loadingInventories && !this.isSaving && this.parentForm.valid &&
      !!String(this.parentForm.get('name')?.value??'').trim() && this.hasChanges;
  }
  onSubmit(): void {
    if (!this.canSave) return;
    this.isSaving = true; this.saveError = ''; this.cdr.markForCheck();
    const value = this.parentForm.getRawValue();
    const name = String(value.name ?? '').trim();
    const inventoryId = Number(value.inventoryId);
    const description = String(value.description ?? '').trim();
    if (!inventoryId) {this.isSaving=false;this.saveError='Selecciona tu inventario de trabajo.';return;}
    const payload: Category = this.isEdit && this.data
      ? {...this.data,name,description,parentCategoryId:null}
      : {id:0,name,description,inventoryId,companyId:0,parentCategoryId:null,isActive:true};
    this.savePayload(payload, false);
  }

  private savePayload(payload: Category, allowSimilar: boolean): void {
    const request$: Observable<Category | void> = this.isEdit ? this.categoryService.updateCategory(payload) : this.categoryService.createCategory(payload,allowSimilar);
    request$.subscribe({
      next: result => {
        this.isSaving = false;
        const reused = !this.isEdit && Boolean(result && 'reused' in result && result.reused);
        if (reused) this.toast.info(`Se reutilizó la categoría «${(result as Category).name}».`,'Categoría existente');
        else this.toast.success(`Categoría ${this.isEdit?'actualizada':'creada'} correctamente.`);
        this.dialogRef.close(true);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        if (!this.isEdit && error.status === 409 && error.error?.code === 'similar_name') {
          this.toast.warning('Encontramos categorías parecidas.','Posible duplicado');
          this.dialogs.open(CatalogSimilarDialogComponent, {data:{type:'categorías',enteredName:payload.name,matches:error.error.matches||[]},width:'min(500px,calc(100vw - 24px))'})
            .afterClosed().subscribe((choice:CatalogSimilarChoice | undefined) => {
              if (choice?.action==='create') {this.isSaving=true;this.savePayload(payload,true);}
              else if(choice?.action==='reuse') {this.toast.info('Se utilizará una categoría ya registrada.');this.dialogRef.close(true);}
              this.cdr.markForCheck();
            });
        } else {
          const body=error.error;
          this.saveError=typeof body==='string'?body:body?.error??body?.message??'No se pudo guardar la categoría.';
          this.toast.error(this.saveError);
        }
        this.cdr.markForCheck();
      }
    });
  }
}
