import { ChangeDetectorRef, DestroyRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ArticleService } from '../../../core/services/articles';
import { Article } from '../../../core/models/article.model';
import { SerialUnitsService } from '../../../core/services/serial-units';

@Component({ selector: 'app-article-detail-dialog', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './article-detail-dialog.html', styleUrl: './article-detail-dialog.scss' })
export class ArticleDetailDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<ArticleDetailDialogComponent>);
  readonly data: {id: number} = inject(MAT_DIALOG_DATA);
  private readonly api = inject(ArticleService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private refreshView(): void { if (!this.destroyRef.destroyed) this.cdr.detectChanges(); }
  private readonly serials=inject(SerialUnitsService);
  newSerial="";savingSerial=false;serialNotice="";
  article: Article | null = null;
  loading = true;
  error = '';
  photo: string | null = null;
  voucher: string | null = null;
  photoIsPdf = false;
  voucherIsPdf = false;

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
        if (article.mainPhotoPath) this.api.getMedia(article.id,'photo').subscribe({next:b=>{this.photo=URL.createObjectURL(b);this.refreshView();}});
        if (article.mainVoucherPath) this.api.getMedia(article.id,'voucher').subscribe({next:b=>{this.voucher=URL.createObjectURL(b);this.voucherIsPdf=b.type==='application/pdf';this.refreshView();}});
      },
      error: err => { this.loading = false; this.error = String(err?.error?.error??'No se pudo consultar el artículo.'); this.refreshView(); }
    });
  }
  addSerial():void {
    if(!this.article || !this.newSerial.trim() || this.savingSerial)return;
    this.savingSerial=true;this.serialNotice='';
    this.serials.add(this.article.id,{serialNumber:this.newSerial.trim()}).subscribe({
      next:()=>{
        this.savingSerial=false;this.newSerial='';this.serialNotice='Unidad registrada con movimiento de entrada.';this.refreshView();
        this.api.getArticle(this.data.id).subscribe({next:a=>{this.article=a;this.refreshView();}});
      },error:e=>{this.savingSerial=false;this.serialNotice=String(e.error?.error??'No se pudo registrar la unidad.');this.refreshView();}
    });
  }
  ngOnDestroy(): void { if(this.photo)URL.revokeObjectURL(this.photo); if(this.voucher)URL.revokeObjectURL(this.voucher); }
}
