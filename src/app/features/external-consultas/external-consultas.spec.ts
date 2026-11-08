import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { ExternalConsultasComponent } from './external-consultas';
import { ExternalConsultasService, ExchangeRate } from '../../core/services/external-consultas';

const quote=(date='2026-11-06'):ExchangeRate=>({id:1,date,baseCurrency:'EUR',quoteCurrency:'PEN',buyPrice:4,sellPrice:4.1});

describe('Exchange rate partial results',()=>{
  it.each(['USD','EUR'])('retains the successful currency when %s fails',failed=>{
    const calls:string[]=[];
    TestBed.configureTestingModule({providers:[{provide:ExternalConsultasService,useValue:{exchangeRate:(code:string)=>{
      calls.push(code);return code===failed?throwError(()=>new Error('offline')):of(quote());
    }}}]});
    const page=TestBed.createComponent(ExternalConsultasComponent).componentInstance;
    page.usd=quote('2020-01-01');page.eur=quote('2020-01-01');
    page.loadRates();
    expect(calls).toEqual(['USD','EUR']);
    expect(failed==='USD'?page.usd:page.eur).toBeNull();
    expect(failed==='USD'?page.eur:page.usd).toBeTruthy();
    expect(failed==='USD'?page.usdError:page.eurError).toBeTruthy();
    expect(page.loadingRates).toBe(false);
  });
  it('classifies calendar dates using Lima even after UTC midnight',()=>{
    TestBed.configureTestingModule({providers:[{provide:ExternalConsultasService,useValue:{}}]});
    const page=TestBed.createComponent(ExternalConsultasComponent).componentInstance;
    const now=new Date('2026-11-07T02:00:00Z');
    expect(page.rateStatus(quote(),now)).toBe('Actual según fecha de API');
    expect(page.rateStatus(quote('2026-11-05'),now)).toBe('Histórico');
    expect(page.rateStatus(quote('2026-11-07'),now)).toContain('futura');
    expect(page.rateStatus(quote('2026-02-30'),now)).toContain('no verificable');
  });
  it('blocks overlapping refreshes and clears previous results',()=>{
    let calls=0;const response=new Subject<ExchangeRate>();
    TestBed.configureTestingModule({providers:[{provide:ExternalConsultasService,useValue:{exchangeRate:()=>{calls++;return response;}}}]});
    const page=TestBed.createComponent(ExternalConsultasComponent).componentInstance;
    page.usd=quote();page.loadRates();page.loadRates();
    expect(calls).toBe(2);expect(page.usd).toBeNull();
    response.next(quote());response.complete();
    expect(page.loadingRates).toBe(false);
  });
});
