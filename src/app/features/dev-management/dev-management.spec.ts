import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { DevManagementComponent } from './dev-management';
import { DevManagementService, DevCompany, ResetPending } from '../../core/services/dev-management';

describe('Dev management independent loads',()=>{
  it('keeps companies when pending requests fail and retries only that section',()=>{
    const companies=new Subject<DevCompany[]>();
    const pending=new Subject<ResetPending[]>();
    let companyCalls=0;let pendingCalls=0;
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:DevManagementService,useValue:{
      list:()=>{companyCalls++;return companies;},pending:()=>{pendingCalls++;return pending;}
    }}]});
    const page=TestBed.createComponent(DevManagementComponent).componentInstance;
    page.reload();page.reload();
    expect(companyCalls).toBe(1);expect(pendingCalls).toBe(1);
    companies.next([{id:4,businessName:'Central'} as DevCompany]);companies.complete();
    pending.error(new Error('offline'));
    expect(page.companies[0].id).toBe(4);
    expect(page.companiesError).toBe('');expect(page.pendingError).toBeTruthy();
    expect(page.loading).toBe(false);
    page.loadPending();expect(companyCalls).toBe(1);expect(pendingCalls).toBe(2);
  });
});
