import { ChangeDetectorRef, DestroyRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoneyPipe } from '../../../shared/money.pipe';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ArticleService } from '../../../core/services/articles';
import { Article, ArticleDetail } from '../../../core/models/article.model';
import { SerialUnitsService } from '../../../core/services/serial-units';
import { CategoryService } from '../../categories/services/category';
import { Category } from '../../../core/models/category.model';
import { ConfirmationDialogService } from '../../../shared/confirm-dialog/confirmation-dialog.service';

type SerialAttrKey = 'attr1' | 'attr2' | 'attr3' | 'attr4' | 'attr5' | 'attr6';
interface SerialAttributeField { key: SerialAttrKey; label: string; required: boolean; }
interface SerialUnitDraft {
  serialNumber: string;
  attr1: string; attr2: string; attr3: string;
  attr4: string; attr5: string; attr6: string;
}

@Component({ selector: 'app-article-detail-dialog', standalone: true,
  imports: [MoneyPipe, CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './article-detail-dialog.html', styleUrl: './article-detail-dialog.scss' })
export class ArticleDetailDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<ArticleDetailDialogComponent>);
  readonly data: {id: number} = inject(MAT_DIALOG_DATA);
  private readonly api = inject(ArticleService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private refreshView(): void { if (!this.destroyRef.destroyed) this.cdr.detectChanges(); }
  private readonly serials=inject(SerialUnitsService);
  private readonly categories=inject(CategoryService);
  private readonly confirms=inject(ConfirmationDialogService);
  registeringBatch=false;
  decommissioningId:number|null=null;
  serialNotice="";
  decommissionReason="";
  hasChanges=false;
  batchAttributes:SerialAttributeField[]=[];
  batchRows:SerialUnitDraft[]=[{
    serialNumber:'',attr1:'',attr2:'',attr3:'',attr4:'',attr5:'',attr6:''
  }];
  article: Article | null = null;
  loading = true;
  error = '';
  photo: string | null = null;
  voucher: string | null = null;
  photoIsPdf = false;
  voucherIsPdf = false;

  get canRegisterBatch(): boolean {
    return !this.registeringBatch && this.batchRows.length > 0 &&
      this.batchRows.every(row => row.serialNumber.trim().length > 0);
  }

  get characteristics(): Array<{name:string;value:string}> {
    try {
      const attrs = JSON.parse(this.article?.characteristics || '{}');
      return Object.entries(attrs).filter(([_,val]) => val != null && String(val).trim())
        .map(([name,val])=>({name,value:String(val)}));
    } catch { return this.article?.characteristics ? [{name:'Características',value:this.article.characteristics}] : []; }
  }
  ngOnInit(): void {
    this.api.getArticle(this.data.id).subscribe({
      next: article => {
        this.article = article; this.loading = false; this.refreshView();
        this.loadBatchAttributes(article);
        if (article.mainPhotoPath) this.api.getMedia(article.id,'photo').subscribe({next:b=>{this.photo=URL.createObjectURL(b);this.refreshView();}});
        if (article.mainVoucherPath) this.api.getMedia(article.id,'voucher').subscribe({next:b=>{this.voucher=URL.createObjectURL(b);this.voucherIsPdf=b.type==='application/pdf';this.refreshView();}});
      },
      error: err => { this.loading = false; this.error = String(err?.error?.error??'No se pudo consultar el artículo.'); this.refreshView(); }
    });
  }
  private loadBatchAttributes(article: Article): void {
    this.categories.getCategories().subscribe({
      next: categories => {
        const category = categories.find(x => Number(x.id) === Number(article.categoryId));
        if (!category) { this.refreshView(); return; }
        const fields: SerialAttributeField[] = [];
        for (let i = 1; i <= 6; i++) {
          const label = category[`label${i}` as keyof Category];
          if (typeof label === 'string' && label.trim()) {
            const unique = category[`isUnique${i}` as keyof Category] === true;
            fields.push({ key: `attr${i}` as SerialAttrKey, label: label.trim(), required: unique });
          }
        }
        this.batchAttributes = fields;
        this.refreshView();
      },
      error: () => { this.serialNotice = 'No se pudieron consultar los atributos de la categoría.'; this.refreshView(); }
    });
  }

  addBatchRow(): void {
    if (this.batchRows.length >= 1000 || this.registeringBatch) return;
    this.batchRows = [...this.batchRows, {
      serialNumber:'',attr1:'',attr2:'',attr3:'',attr4:'',attr5:'',attr6:''
    }];
  }

  removeBatchRow(index: number): void {
    if (this.registeringBatch || this.batchRows.length <= 1) return;
    this.batchRows = this.batchRows.filter((_, i) => i !== index);
  }

  registerBatch(): void {
    const article = this.article;
    if (!article || !article.isActive || this.registeringBatch || !this.batchRows.length) return;
    const rows = this.batchRows.map(row => ({
      serialNumber: row.serialNumber.trim(),
      attr1: row.attr1.trim(), attr2: row.attr2.trim(), attr3: row.attr3.trim(),
      attr4: row.attr4.trim(), attr5: row.attr5.trim(), attr6: row.attr6.trim()
    }));
    if (rows.length > 1000 || rows.some(row => !row.serialNumber || row.serialNumber.length > 150)) {
      this.serialNotice = 'Todas las unidades necesitan un número de serie de hasta 150 caracteres.';
      return;
    }
    const serials = rows.map(row => row.serialNumber.toLocaleUpperCase('es-PE'));
    if (new Set(serials).size !== serials.length) {
      this.serialNotice = 'El lote contiene números de serie duplicados.';
      return;
    }
    for (const field of this.batchAttributes.filter(x => x.required)) {
      const values = rows.map(row => row[field.key].trim().toLocaleUpperCase('es-PE'));
      if (values.some(value => !value)) {
        this.serialNotice = `Completa el atributo obligatorio «${field.label}» en todas las unidades.`;
        return;
      }
      if (new Set(values).size !== values.length) {
        this.serialNotice = `El atributo «${field.label}» debe ser diferente para cada unidad del lote.`;
        return;
      }
    }

    this.registeringBatch = true;
    this.serialNotice = '';
    this.serials.addBatch(article.id, rows).subscribe({
      next: result => {
        this.registeringBatch = false;
        this.hasChanges = true;
        this.serialNotice = `Se registraron ${result.added} unidades serializadas. Stock actual: ${result.stock}.`;
        this.batchRows = [{
          serialNumber:'',attr1:'',attr2:'',attr3:'',attr4:'',attr5:'',attr6:''
        }];
        this.reloadArticle();
      },
      error: err => {
        this.registeringBatch = false;
        this.serialNotice = String(err?.error?.error ?? 'No se pudo registrar el lote.');
        this.refreshView();
      }
    });
  }

  decommission(detail: ArticleDetail): void {
    const article = this.article;
    const reason = this.decommissionReason.trim();
    if (!article || !article.isActive || detail.isActive === false || this.decommissioningId !== null) return;
    if (reason.length < 5 || reason.length > 500) {
      this.serialNotice = 'Escribe un motivo de baja de entre 5 y 500 caracteres.';
      return;
    }
    this.confirms.confirm({
      title: 'Dar de baja unidad serializada',
      message: `¿Retirar definitivamente la serie «${detail.serialNumber}»? La unidad quedará inactiva y se conservará en el historial. Motivo: ${reason}`,
      confirmLabel: 'Dar de baja', tone: 'danger', icon: 'remove_circle'
    }).subscribe(confirmed => {
      if (!confirmed || this.decommissioningId !== null) return;
      this.decommissioningId = detail.id;
      this.serials.decommission(article.id, detail.id, reason).subscribe({
        next: result => {
          this.decommissioningId = null;
          this.hasChanges = true;
          this.decommissionReason = '';
          this.serialNotice = `La serie ${result.serialNumber} fue retirada. Stock actual: ${result.stock}.`;
          this.reloadArticle();
        },
        error: err => {
          this.decommissioningId = null;
          this.serialNotice = String(err?.error?.error ?? 'No se pudo dar de baja la unidad.');
          this.refreshView();
        }
      });
    });
  }

  private reloadArticle(): void {
    this.api.getArticle(this.data.id).subscribe({
      next: article => { this.article = article; this.refreshView(); },
      error: () => { this.serialNotice += ' Actualiza la ficha para consultar el estado reciente.'; this.refreshView(); }
    });
  }
  ngOnDestroy(): void { if(this.photo)URL.revokeObjectURL(this.photo); if(this.voucher)URL.revokeObjectURL(this.voucher); }
}
