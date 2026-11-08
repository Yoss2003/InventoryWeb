import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CompanyPublicService } from '../../core/services/companies';
import { CompanySelectorComponent } from '../../shared/company-selector/company-selector';
import { CompanyPublic } from '../../core/models/company-public.model';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';

@Component({selector:'app-password-recovery',standalone:true,imports:[CommonModule,FormsModule,RouterModule,CompanySelectorComponent,LoadingIndicatorComponent],templateUrl:'./password-recovery.html',styleUrl:'./password-recovery.scss'})
export class PasswordRecoveryComponent implements OnInit {
  private readonly http=inject(HttpClient);
  private readonly route=inject(ActivatedRoute);
  private readonly companiesApi=inject(CompanyPublicService);
  private readonly cdr=inject(ChangeDetectorRef);
  loadingCompanies=false; companiesError='';
  companies:CompanyPublic[]=[];companyId:number|null=null;username='';token='';password='';confirmPassword='';sending=false;message='';error='';
  ngOnInit():void{this.token=this.route.snapshot.queryParamMap.get('token')||'';
    if(!this.token)this.loadCompanies();}
  loadCompanies():void {
    if(this.loadingCompanies || this.sending)return;
    this.loadingCompanies=true;this.companiesError='';
    this.cdr.markForCheck();
    this.companiesApi.getActiveCompanies().subscribe({
      next:data=>{
        this.companies=data;
        this.companyId=data.some(c=>c.id===this.companyId)?this.companyId:(data.length===1?data[0].id:null);
        this.loadingCompanies=false;
        if(!data.length)this.companiesError='No hay empresas activas disponibles.';
        this.cdr.markForCheck();
      },
      error:()=>{
        this.companies=[];this.companyId=null;this.loadingCompanies=false;
        this.companiesError='No fue posible consultar empresas. Vuelve a intentar.';
        this.cdr.markForCheck();
      }
    });
  }
  submit():void {
    if(this.sending || this.loadingCompanies)return;this.error='';this.message='';
    if(this.token && (this.password.length<12 || this.password!==this.confirmPassword)){
      this.error='Utiliza al menos 12 caracteres y confirma la contraseña.';return;}
    if(!this.token && (!this.companies.some(c=>c.id===this.companyId) || !this.username.trim())){
      this.error='Selecciona tu empresa e indica tu usuario o correo.';return;}
    this.sending=true;
    this.cdr.markForCheck();
    const url='https://localhost:7295/api/password-recovery';
    const request=this.token?this.http.post<{message:string}>(`${url}/complete`,{token:this.token,newPassword:this.password}):
      this.http.post<{message:string}>(`${url}/request`,{companyId:this.companyId,usernameOrEmail:this.username.trim()});
    request.subscribe({
      next:r=>{this.sending=false;this.message=r.message;this.password='';this.confirmPassword='';this.token='';this.cdr.markForCheck();},
      error:e=>{this.sending=false;this.error=String(e.error?.error||'No fue posible procesar la solicitud.');this.cdr.markForCheck();}
    });
  }
}
