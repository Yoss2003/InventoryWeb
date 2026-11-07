import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, finalize, forkJoin, of, timeout } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ExternalConsultasService, SunatRuc, ExchangeRate } from '../../core/services/external-consultas';
@Component({selector:'app-external-consultas',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./external-consultas.html',styleUrl:'./external-consultas.scss'})
export class ExternalConsultasComponent {
  private readonly api=inject(ExternalConsultasService);
  ruc=''; sunat:SunatRuc|null=null; usd:ExchangeRate|null=null; eur:ExchangeRate|null=null;
  error=''; usdError=''; eurError=''; loadingRuc=false; loadingRates=false;
  searchRuc():void {
    this.error='';this.sunat=null;if(!/^\d{11}$/.test(this.ruc)){this.error='RUC inválido (11 dígitos).';return;}
    this.loadingRuc=true;this.api.ruc(this.ruc).subscribe({next:r=>{this.sunat=r;this.loadingRuc=false;},error:()=>{this.error='No se pudo consultar el RUC. Revisa el token SUNAT en la API.';this.loadingRuc=false;}});
  }
  loadRates():void {
    if(this.loadingRates)return;
    this.loadingRates=true;this.usd=null;this.eur=null;this.usdError='';this.eurError='';
    const rate=(currency:'USD'|'EUR')=>this.api.exchangeRate(currency).pipe(timeout(20000),catchError(()=>{
      if(currency==='USD')this.usdError='No se pudo consultar USD. Vuelve a intentar.';
      else this.eurError='No se pudo consultar EUR. Vuelve a intentar.';
      return of(null);
    }));
    forkJoin({usd:rate('USD'),eur:rate('EUR')}).pipe(finalize(()=>this.loadingRates=false))
      .subscribe(result=>{this.usd=result.usd;this.eur=result.eur;});
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
