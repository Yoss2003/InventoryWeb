import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ExternalConsultasService, SunatRuc, ExchangeRate } from '../../core/services/external-consultas';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';
import { ToastService } from '../../shared/toast/toast.service';

@Component({selector:'app-external-consultas',standalone:true,imports:[CommonModule,FormsModule,LoadingIndicatorComponent],templateUrl:'./external-consultas.html',styleUrl:'./external-consultas.scss'})
export class ExternalConsultasComponent {
  private readonly api=inject(ExternalConsultasService);
  private readonly cdr=inject(ChangeDetectorRef);
  private readonly toast=inject(ToastService); // UX_FINAL_TOAST_CONSULTAS
  ruc=''; sunat:SunatRuc|null=null; usd:ExchangeRate|null=null; eur:ExchangeRate|null=null;
  usdStatus='';eurStatus='';
  error=''; usdError=''; eurError=''; loadingRuc=false; loadingRates=false;
  private pendingRates=0;

  searchRuc():void {
    this.error='';this.sunat=null;
    if(!/^\d{11}$/.test(this.ruc)){this.error='RUC inválido (11 dígitos).';this.toast.warning(this.error);return;}
    if(this.loadingRuc)return;
    this.loadingRuc=true;this.cdr.markForCheck();
    this.api.ruc(this.ruc).subscribe({
      next:r=>{this.sunat=r;this.loadingRuc=false;this.cdr.markForCheck();},
      error:()=>{
        this.error='No se pudo consultar el RUC. Verifica el servicio de consulta en la API.';this.toast.error(this.error);
        this.loadingRuc=false;this.cdr.markForCheck();
      }
    });
  }

  loadRates():void {
    if(this.loadingRates)return;
    this.loadingRates=true;
    this.pendingRates=2;
    this.usd=null;this.eur=null;
    this.usdStatus='';this.eurStatus='';
    this.usdError='';this.eurError='';
    this.cdr.markForCheck();

    this.loadSingleRate('USD');
    this.loadSingleRate('EUR');
  }

  private loadSingleRate(currency:'USD'|'EUR'):void {
    this.api.exchangeRate(currency).pipe(
      timeout(20000),
      finalize(()=>{
        this.pendingRates=Math.max(0,this.pendingRates-1);
        this.loadingRates=this.pendingRates>0;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next:rate=>{
        if(currency==='USD'){
          this.usd=rate;
          this.usdStatus=this.rateStatus(rate);
        }else{
          this.eur=rate;
          this.eurStatus=this.rateStatus(rate);
        }
        this.cdr.markForCheck();
      },
      error:()=>{
        if(currency==='USD')this.usdError='No se pudo consultar USD. Vuelve a intentar.';
        else this.eurError='No se pudo consultar EUR. Vuelve a intentar.';
        this.toast.error(currency==='USD'?this.usdError:this.eurError);
        this.cdr.markForCheck();
      }
    });
  }

  rateStatus(rate:ExchangeRate,now=new Date()):string {
    // La API entrega una fecha civil, no una hora que deba convertirse de zona.
    const date=rate.date?.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)return 'Fecha no verificable';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const part=(name:string)=>parts.find(item=>item.type===name)?.value;
    const today=`${part('year')}-${part('month')}-${part('day')}`;
    return date===today?'Actual según fecha de API':date<today?'Histórico':'Fecha futura: verificar';
  }
}
