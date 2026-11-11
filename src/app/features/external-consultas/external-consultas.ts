import { UiTableActionDirective } from '../../shared/ui/v2/ui-table-action.directive';
import { UiControlDirective } from '../../shared/ui/v2/ui-control.directive';
import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { finalize, timeout } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ExternalConsultasService, SupplierContact, SunatRuc, ExchangeRate } from '../../core/services/external-consultas';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';
import { ToastService } from '../../shared/toast/toast.service';

@Component({selector:'app-external-consultas',standalone:true,imports:[UiControlDirective, UiTableActionDirective, UiPageHeadingComponent, CommonModule,FormsModule,LoadingIndicatorComponent,MatIconModule,MatDatepickerModule,MatFormFieldModule,MatInputModule],providers:[provideNativeDateAdapter(),{provide:MAT_DATE_LOCALE,useValue:'es-PE'}],templateUrl:'./external-consultas.html',styleUrl:'./external-consultas.scss'})
export class ExternalConsultasComponent implements OnInit {
  private readonly api=inject(ExternalConsultasService);
  private readonly cdr=inject(ChangeDetectorRef);
  private readonly matDialog=inject(MatDialog);
  @ViewChild('fxHistoryDialog') private fxHistoryTemplate?: TemplateRef<unknown>;
  private fxHistoryRef?: MatDialogRef<unknown>;
  private readonly toast=inject(ToastService); // UX_FINAL_TOAST_CONSULTAS
  ruc=''; sunat:SunatRuc|null=null; usd:ExchangeRate|null=null; eur:ExchangeRate|null=null;
  usdStatus='';eurStatus='';
  error=''; usdError=''; eurError=''; loadingRuc=false; loadingRates=false;
  private pendingRates=0;
  ratesFrom=''; ratesTo=''; loadingHistory=false; historyRequested=false;
  historyError=''; historyRates:ExchangeRate[]=[];
  // PROVEEDORES_CONSULTAS_V1: catálogo de lectura dentro de Consultas SUNAT.
  @ViewChild('rucLookupPanel') private rucLookupPanel?: ElementRef<HTMLElement>;
  suppliersOpen = false;
  suppliersLoaded = false;
  suppliersLoading = false;
  suppliersError = '';
  supplierSearch = '';
  suppliers: SupplierContact[] = [];

  get filteredSuppliers(): SupplierContact[] {
    const search = this.supplierSearch.trim().toLocaleLowerCase('es');
    const visible = this.suppliers.filter(item => item?.isActive !== false);
    const filtered = !search ? visible : visible.filter(item =>
      [item.ruc, item.businessName, item.contactName, item.email, item.phone]
        .some(value => String(value ?? '').toLocaleLowerCase('es').includes(search)));
    return filtered.sort((a, b) => String(a.businessName ?? '')
      .localeCompare(String(b.businessName ?? ''), 'es'));
  }

  toggleSuppliers(): void {
    this.suppliersOpen = !this.suppliersOpen;
    if (this.suppliersOpen && !this.suppliersLoaded && !this.suppliersLoading)
      this.loadSuppliers();
  }

  loadSuppliers(): void {
    if (this.suppliersLoading) return;
    this.suppliersLoading = true;
    this.suppliersError = '';
    this.api.suppliers().pipe(
      timeout(20000),
      finalize(() => { this.suppliersLoading = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: list => {
        this.suppliers = Array.isArray(list) ? list.filter(item => item && item.isActive !== false) : [];
        this.suppliersLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.suppliersError = 'No se pudieron cargar los proveedores de tu empresa. Intenta nuevamente.';
        this.cdr.markForCheck();
      }
    });
  }

  consultSupplierRuc(supplier: SupplierContact): void {
    const ruc = String(supplier.ruc ?? '').trim();
    if (!/^\d{11}$/.test(ruc)) {
      this.toast.warning('Este proveedor no tiene un RUC válido para consultar.');
      return;
    }
    if (this.loadingRuc) return;
    this.ruc = ruc;
    this.searchRuc(); // Reutiliza la consulta SUNAT existente, sin guardar datos.
    this.rucLookupPanel?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  supplierEmailLink(value?: string | null): string | null {
    const email = String(value ?? '').trim();
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) ? `mailto:${email}` : null;
  }

  supplierPhoneLink(value?: string | null): string | null {
    const phone = String(value ?? '').trim().replace(/[\s().-]/g, '');
    return /^\+?\d{6,15}$/.test(phone) ? `tel:${phone}` : null;
  }

  openAdvancedFilters():void {
    if (!this.fxHistoryTemplate || this.fxHistoryRef) return;
    const ref=this.matDialog.open(this.fxHistoryTemplate,{
      panelClass:['fx-history-modal','inv-seven-modal'],enterAnimationDuration:260,exitAnimationDuration:220,
      width:'min(620px, calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',
      maxHeight:'calc(100dvh - 24px)',autoFocus:false,restoreFocus:true
    });
    this.fxHistoryRef=ref;
    ref.afterClosed().subscribe(()=>{if(this.fxHistoryRef===ref)this.fxHistoryRef=undefined;});
  }
  closeAdvancedFilters():void {this.fxHistoryRef?.close();}
  /* Última cotización verificada al entrar a la vista. */
  ngOnInit():void { this.loadRates(); }
  get ratesFromDate():Date|null { return this.ratesFrom ? new Date(this.ratesFrom+'T12:00:00') : null; }
  get ratesToDate():Date|null { return this.ratesTo ? new Date(this.ratesTo+'T12:00:00') : null; }
  setRatesFrom(date:Date|null):void { this.ratesFrom=this.dateOnly(date); }
  setRatesTo(date:Date|null):void { this.ratesTo=this.dateOnly(date); }
  private dateOnly(date:Date|null):string { if(!date||Number.isNaN(date.getTime()))return '';const pad=(n:number)=>String(n).padStart(2,'0');return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate()); }
  clearRuc():void { this.ruc=''; this.sunat=null; this.error=''; this.cdr.markForCheck(); }

  loadHistoryRates():void {
    if(this.loadingHistory)return;
    this.historyError=''; this.historyRequested=false;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(this.ratesFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(this.ratesTo)){
      this.historyError='Selecciona ambas fechas para consultar el historial.';this.cdr.markForCheck();return;
    }
    if(this.ratesFrom>this.ratesTo){this.historyError='La fecha Desde no puede ser posterior a Hasta.';this.cdr.markForCheck();return;}
    this.loadingHistory=true;this.cdr.markForCheck();
    this.api.exchangeRatesAll().pipe(timeout(20000),finalize(()=>{this.loadingHistory=false;this.cdr.markForCheck();})).subscribe({
      next:rates=>{
        this.historyRates=(Array.isArray(rates)?rates:[]).filter(rate=>
          (rate.baseCurrency==='USD'||rate.baseCurrency==='EUR') &&
          (rate.date||'').slice(0,10)>=this.ratesFrom && (rate.date||'').slice(0,10)<=this.ratesTo
        ).sort((a,b)=>b.date.localeCompare(a.date));
        this.historyRequested=true;this.cdr.markForCheck();
      },
      error:()=>{this.historyError='No se pudo consultar el historial registrado en la API.';this.cdr.markForCheck();}
    });
  }

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
