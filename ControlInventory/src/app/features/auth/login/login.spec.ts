import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { Login } from './login';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyPublicService } from '../../../core/services/companies';
import { CompanyPublic } from '../../../core/models/company-public.model';

describe('Login company selection', () => {
  it('restores only an active remembered company and blocks submission while refreshing', async () => {
    const requests=new Subject<CompanyPublic[]>();
    let logins=0;
    await TestBed.configureTestingModule({imports:[Login],providers:[provideRouter([]),
      {provide:CompanyPublicService,useValue:{getActiveCompanies:()=>requests,publicLogoUrl:()=>null}},
      {provide:AuthService,useValue:{getLastSelectedCompanyId:()=>2,login:()=>{logins++;return of({});}}}
    ]}).compileComponents();
    const fixture=TestBed.createComponent(Login);
    fixture.detectChanges();
    requests.next([{id:1,businessName:'A'},{id:2,businessName:'B'}]);
    expect(fixture.componentInstance.selectedCompany?.id).toBe(2);
    fixture.componentInstance.loginForm.patchValue({username:'user',password:'password'});
    fixture.componentInstance.loadCompanies();
    fixture.componentInstance.onSubmit();
    expect(logins).toBe(0);
    requests.next([{id:1,businessName:'A'},{id:3,businessName:'C'}]);
    expect(fixture.componentInstance.selectedCompany).toBeNull();
  });
});
