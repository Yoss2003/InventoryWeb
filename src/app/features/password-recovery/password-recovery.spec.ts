import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { PasswordRecoveryComponent } from './password-recovery';
import { CompanyPublicService } from '../../core/services/companies';

describe('Password recovery companies',()=>{
  it('can retry a failed company load and rejects an unavailable company',async()=>{
    let fail=true;
    await TestBed.configureTestingModule({imports:[PasswordRecoveryComponent],providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),
      {provide:CompanyPublicService,useValue:{getActiveCompanies:()=>fail?throwError(()=>new Error('offline')):of([{id:7,businessName:'Central'}])}}
    ]}).compileComponents();
    const fixture=TestBed.createComponent(PasswordRecoveryComponent);
    fixture.detectChanges();
    const page=fixture.componentInstance;
    expect(page.companiesError).toBeTruthy();
    fail=false;page.loadCompanies();
    expect(page.companyId).toBe(7);
    page.companyId=99;page.username='user';page.submit();
    expect(page.error).toContain('Selecciona');
    TestBed.inject(HttpTestingController).expectNone('https://localhost:7295/api/password-recovery/request');
  });
});
