import { UiButtonDirective } from '../../shared/ui/v2/ui-button.directive';
import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { CleanArticleNamePipe } from '../../shared/clean-article-name.pipe';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { AssignmentService, AssignedArticle } from '../../core/services/assignments';
import { AssignmentHistoryDialogComponent } from '../assignment-history-dialog/assignment-history-dialog';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';

import { UiSearchComponent } from '../../shared/ui/ui-search.component';

@Component({selector:'app-assignment-history',standalone:true,
  imports:[UiButtonDirective, UiPageHeadingComponent, CleanArticleNamePipe, CommonModule,FormsModule,MatIconModule,LoadingIndicatorComponent,UiSearchComponent],
  templateUrl:'./assignment-history.html',styleUrl:'./assignment-history.scss'})
export class AssignmentHistoryComponent implements OnInit {
  private readonly api=inject(AssignmentService);
  private readonly dialog=inject(MatDialog);
  private readonly cdr=inject(ChangeDetectorRef);
  outgoing:AssignedArticle[]=[];received:AssignedArticle[]=[];
  currentTab:'history'|'received'='history';search='';
  loading=false;hasLoaded=false;errorMessage='';
  get rows():AssignedArticle[]{return this.currentTab==='received'?this.received:this.outgoing;}
  get filteredRows():AssignedArticle[]{
    const query=this.search.trim().toLocaleLowerCase('es');
    if(!query)return this.rows;
    return this.rows.filter(r=>[r.articleName,r.articleCode,r.recipientName,r.observation||'',String(r.id)]
      .some(v=>v.toLocaleLowerCase('es').includes(query)));
  }
  get pendingQuantity():number{return this.outgoing.reduce((n,a)=>n+Number(a.remainingQuantity),0);}
  get activeAssignments():number{return this.outgoing.filter(a=>a.remainingQuantity>0).length;}
  get distinctArticles():number{return new Set(this.outgoing.map(r=>r.articleId)).size;}
  ngOnInit():void{this.loadHistory();}
  loadHistory():void{
    if(this.loading)return;
    this.loading=true;this.errorMessage='';this.cdr.markForCheck();
    forkJoin({outgoing:this.api.outgoing(),received:this.api.received()}).subscribe({
      next:({outgoing,received})=>{
        this.outgoing=outgoing;this.received=received;
        this.loading=false;this.hasLoaded=true;this.cdr.markForCheck();
      },error:err=>{
        this.loading=false;this.hasLoaded=true;
        this.errorMessage=String(err?.error?.error??'No se pudieron actualizar las asignaciones. Los datos anteriores pueden estar desactualizados.');
        this.cdr.markForCheck();
      }
    });
  }
  openDetail(row:AssignedArticle):void{
    const ref=this.dialog.open(AssignmentHistoryDialogComponent,{
      data:row,width:'min(710px, calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',
      maxHeight:'calc(100dvh - 24px)',autoFocus:false,panelClass:'assignment-history-dialog-panel'
    });
    ref.afterClosed().subscribe(changed=>{if(changed)this.loadHistory();});
  }
}
