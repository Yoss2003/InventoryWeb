import { CleanArticleNamePipe } from '../../../shared/clean-article-name.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { InventoryContextService } from '../../../core/services/inventory-context';
import { InventoryDialogMotionDirective } from '../../../shared/ui/inv-dialog-motion.directive';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ArticleService } from '../../../core/services/articles';
import { MovementService } from '../../../core/services/movement';
import { AssignmentService, AssignmentRecipient } from '../../../core/services/assignments';
import { Article } from '../../../core/models/article.model';
import { SerialUnitsService, SerialUnit } from '../../../core/services/serial-units';

@Component({
  selector: 'app-traspaso-form',
  standalone: true,
  imports: [InventoryDialogMotionDirective, CleanArticleNamePipe, CommonModule, ReactiveFormsModule, MatDialogModule, MatInputModule, MatSelectModule, MatIconModule, MatFormFieldModule],
  templateUrl: './traspaso-form.html',
  styleUrl: './traspaso-form.scss'
})
export class TraspasoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly articlesApi = inject(ArticleService);
  private readonly inventoryContext = inject(InventoryContextService);
  private readonly serialsApi = inject(SerialUnitsService);
  private readonly movementsApi = inject(MovementService);
  private readonly assignmentsApi = inject(AssignmentService);
  private readonly toast = inject(ToastService);
  readonly dialogRef = inject(MatDialogRef<TraspasoFormComponent>);
  articles: Article[] = [];
  step = 1;
  get selectedArticle():Article|undefined {return this.articles.find(a=>a.id===Number(this.form.controls.articleId.value));}
  get selectedInventoryLabel(): string {
    const id = Number(this.selectedArticle?.inventoryId);
    const inventory = this.inventoryContext.options.find(i => i.id === id);
    return inventory?.alias?.trim() || inventory?.inventoryName || (id > 0 ? `Inventario #${id}` : 'Selecciona un artículo');
  }
  availableSerials:SerialUnit[]=[];
  selectedSerialIds:number[]=[];
  serialError='';
  get isSerialized():boolean {return !!this.selectedArticle &&
    (Number(this.selectedArticle.tracking)===1 || /^(serialized|serializado|1)$/i.test(String(this.selectedArticle.trackingMode??'')));}
  toggleSerial(id:number,checked:boolean):void {
    this.selectedSerialIds=checked?[...this.selectedSerialIds,id]:this.selectedSerialIds.filter(x=>x!==id);
    this.form.controls.amount.setValue(this.selectedSerialIds.length);
  }
  selectedSerial(id:number):boolean{return this.selectedSerialIds.includes(id);}

  get canAdvanceOperation():boolean {
    const qty=Number(this.form.controls.amount.value);
    return !!this.form.controls.operationType.value && !!this.selectedArticle &&
      !!this.form.controls.retireType.value && this.selectedArticleStock>0 && qty>0 && qty<=this.selectedArticleStock &&
      (!this.isSerialized || (this.operationType==='Asignar' && Number.isInteger(qty) && this.selectedSerialIds.length===qty));
  }
  get canAdvanceRecipient():boolean {
    return !!this.form.controls.observation.value?.trim() &&
      (this.operationType!=='Asignar'||!!this.form.controls.recipientName.value?.trim());
  }
  goStep(next:number):void {
    if(this.isSaving||next<1||next>3)return;
    if(next>1&&!this.canAdvanceOperation)return;
    if(next>2&&!this.canAdvanceRecipient)return;
    this.step=next;
  }
  nextStep():void{this.goStep(this.step+1);}
  previousStep():void{this.goStep(this.step-1);}

  recipients: AssignmentRecipient[] = [];
  selectedArticleStock = 0;
  isSaving = false;
  evidence: File | null = null;
  evidencePreview: string | null = null;
  loadingError = '';
  readonly form = this.fb.group({
    operationType: ['Asignar', Validators.required],
    articleId: [null as number | null, Validators.required],
    retireType: ['Parcial', Validators.required],
    amount: [1, [Validators.required, Validators.min(0.01)]],
    recipientUserId: [null as number | null],
    recipientName: ['', Validators.maxLength(180)],
    observation: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  get quantityExceedsStock(): boolean { return Number(this.form.controls.amount.value) > this.selectedArticleStock; }
  get operationType(): string { return String(this.form.controls.operationType.value); }
  get canSubmit(): boolean {
    const amount = Number(this.form.controls.amount.value);
    return !this.isSaving && this.form.valid && this.selectedArticleStock > 0 && amount > 0 &&
      amount <= this.selectedArticleStock &&
      (this.operationType !== 'Asignar' || !!this.form.controls.recipientName.value?.trim()) &&
      (!this.isSerialized || (this.operationType === 'Asignar' && Number.isInteger(amount) && this.selectedSerialIds.length === amount));
  }

  ngOnInit(): void {
    this.articlesApi.getArticles().subscribe({
      next: data => this.articles = data.filter(a => a.isActive && Number(a.stock) > 0),
      error: () => this.loadingError = 'No se pudieron consultar los artículos.'
    });
    this.assignmentsApi.recipients().subscribe({
      next: data => this.recipients = data,
      error: () => this.loadingError = 'No se pudieron consultar destinatarios con cuenta; puedes registrar una entidad externa.'
    });
    this.form.controls.articleId.valueChanges.subscribe(id => {
      this.selectedArticleStock = Number(this.articles.find(a => a.id === Number(id))?.stock ?? 0);
      this.adjustQuantity();
      this.availableSerials=[];this.selectedSerialIds=[];this.serialError='';
      const article=this.articles.find(a=>a.id===Number(id));
      if(article && (Number(article.tracking)===1 || /^(serialized|serializado|1)$/i.test(String(article.trackingMode??''))))
        this.serialsApi.available(article.id).subscribe({next:rows=>this.availableSerials=rows,
          error:()=>this.serialError='No se pudieron cargar las series disponibles.'});
    });
    this.form.controls.retireType.valueChanges.subscribe(() => this.adjustQuantity());
    this.form.controls.recipientUserId.valueChanges.subscribe(id => {
      if (id == null) return;
      const person = this.recipients.find(u => u.id === Number(id));
      if (person) this.form.controls.recipientName.setValue(person.name);
    });
  }

  private adjustQuantity(): void {
    if (this.form.controls.retireType.value === 'Total') {
      this.form.controls.amount.setValue(this.selectedArticleStock, {emitEvent: false});
      this.form.controls.amount.disable({emitEvent: false});
    } else {
      this.form.controls.amount.enable({emitEvent: false});
      if (Number(this.form.controls.amount.value) > this.selectedArticleStock)
        this.form.controls.amount.setValue(this.selectedArticleStock, {emitEvent: false});
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8_000_000) {
      this.toast.warning('Usa una imagen JPG/PNG/WEBP de menos de 8 MB.');
      return;
    }
    this.removePhoto();
    this.evidence = file;
    this.evidencePreview = URL.createObjectURL(file);
  }
  removePhoto(): void {
    if (this.evidencePreview) URL.revokeObjectURL(this.evidencePreview);
    this.evidence = null;
    this.evidencePreview = null;
  }
  close(): void { this.removePhoto(); this.dialogRef.close(); }
  onSubmit(): void {
    if (!this.canSubmit) return;
    const v = this.form.getRawValue();
    const amount = Number(v.amount);
    this.isSaving = true;
    if (this.operationType === 'Asignar') {
      this.assignmentsApi.assign({
        articleId: Number(v.articleId), quantity: amount,
        recipientUserId: v.recipientUserId,
        recipientName: String(v.recipientName).trim(),
        observation: String(v.observation), operationKey: crypto.randomUUID(),
        detailIds: this.isSerialized ? this.selectedSerialIds : []
      }).subscribe({
        next: data => {
          if (!this.evidence) { this.saved(); return; }
          this.assignmentsApi.uploadEvidence(data.id, this.evidence).subscribe({
            next: () => this.saved(),
            error: () => {
              this.isSaving = false;
              this.toast.warning('La asignación se registró, pero falló el archivo. Puedes consultar la entrega en Artículos asignados.');
              this.closeWithRefresh();
            }
          });
        },
        error: err => this.failed(err)
      });
    } else {
      if (this.evidence) {
        this.isSaving = false;
        this.toast.warning('La baja sin custodia aún no admite evidencia. Quita la foto antes de registrar.');
        return;
      }
      this.movementsApi.createMovement({
        articleId: Number(v.articleId), actionId: 2, amount,
        recipient: String(v.recipientName || 'Baja interna'), observation: String(v.observation),
        movementDate: new Date().toISOString(), companyId: 0
      }).subscribe({ next: () => this.saved(), error: err => this.failed(err) });
    }
  }
  private saved(): void {
    this.isSaving = false;
    this.toast.success('Operación registrada y stock actualizado.');
    this.closeWithRefresh();
  }
  private closeWithRefresh(): void { this.removePhoto(); this.dialogRef.close(true); }
  private failed(err: any): void {
    this.isSaving = false;
    this.toast.error(String(err?.error?.error ?? `No se pudo registrar (HTTP ${err?.status ?? '?'}).`));
  }
}
