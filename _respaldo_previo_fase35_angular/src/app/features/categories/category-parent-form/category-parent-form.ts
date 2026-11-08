import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryService } from '../services/category';
import { Category } from '../../../core/models/category.model';
import { InventoryService, InventorySummary } from '../../../core/services/inventories';
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
  private readonly snackBar = inject(MatSnackBar);
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
        this.inventories = data.filter(i => i.isActive || i.id === this.data?.inventoryId);
        if (!this.isEdit && this.inventories.length === 1) this.parentForm.controls.inventoryId.setValue(this.inventories[0].id);
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
    this.isSaving=true;this.saveError='';this.cdr.markForCheck();
    const value=this.parentForm.getRawValue();
    const name=String(value.name??'').trim();
    const inventoryId=Number(value.inventoryId);
    if (!inventoryId){this.isSaving=false;this.saveError='Selecciona un almacén válido.';this.cdr.markForCheck();return;}
    const description=String(value.description??'').trim();
    const payload:Category=this.isEdit && this.data
      ? {...this.data,name,description,parentCategoryId:null}
      : {id:0,name,description,inventoryId,companyId:0,parentCategoryId:null,isActive:true};
    const onSuccess=():void=>{
      this.isSaving=false;
      this.snackBar.open(`Categoría ${this.isEdit?'actualizada':'creada'} correctamente`,'Cerrar',{duration:3000});
      this.dialogRef.close(true);
    };
    const onError=(error:{error?:{error?:string;message?:string}|string}):void=>{
      this.isSaving=false;
      const body=error.error;
      this.saveError=typeof body==='string'?body:body?.error??body?.message??'No se pudo guardar la categoría.';
      this.cdr.markForCheck();
    };
    if (this.isEdit) this.categoryService.updateCategory(payload).subscribe({next:onSuccess,error:onError});
    else this.categoryService.createCategory({name,description,inventoryId,companyId:payload.companyId,parentCategoryId:null,isActive:true}).subscribe({next:onSuccess,error:onError});
  }
}
