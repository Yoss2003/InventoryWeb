import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExternalConsultasService, SunatRuc, ExchangeRate } from '../../core/services/external-consultas';
@Component({selector:'app-external-consultas',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./external-consultas.html',styleUrl:'./external-consultas.scss'})
export class ExternalConsultasComponent {
  private readonly api=inject(ExternalConsultasService);
  ruc=''; sunat:SunatRuc|null=null; usd:ExchangeRate|null=null; eur:ExchangeRate|null=null;
  error=''; loadingRuc=false; loadingRates=false;
  searchRuc():void {
    this.error='';this.sunat=null;if(!/^\d{11}$/.test(this.ruc)){this.error='RUC inválido (11 dígitos).';return;}
    this.loadingRuc=true;this.api.ruc(this.ruc).subscribe({next:r=>{this.sunat=r;this.loadingRuc=false;},error:()=>{this.error='No se pudo consultar el RUC. Revisa el token SUNAT en la API.';this.loadingRuc=false;}});
  }
  loadRates():void {
    this.error='';this.loadingRates=true;
    this.api.exchangeRate('USD').subscribe({next:r=>{this.usd=r;this.api.exchangeRate('EUR').subscribe({next:e=>{this.eur=e;this.loadingRates=false;},error:()=>{this.loadingRates=false;this.error='No se pudo consultar EUR.';}});},
      error:()=>{this.loadingRates=false;this.error='No se pudo consultar el tipo de cambio.';}});
  }
}
