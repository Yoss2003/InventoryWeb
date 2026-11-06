import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CompanyPublicService } from '../../core/services/companies';
import { CompanyPublic } from '../../core/models/company-public.model';

@Component({selector:'app-password-recovery',standalone:true,imports:[CommonModule,FormsModule,RouterModule],templateUrl:'./password-recovery.html',styleUrl:'./password-recovery.scss'})
export class PasswordRecoveryComponent implements OnInit {
  private readonly http=inject(HttpClient);
  private readonly route=inject(ActivatedRoute);
  private readonly companiesApi=inject(CompanyPublicService);
  companies:CompanyPublic[]=[];companyId:number|null=null;username='';token='';password='';confirmPassword='';sending=false;message='';error='';
  ngOnInit():void{this.token=this.route.snapshot.queryParamMap.get('token')||'';
    if(!this.token)this.companiesApi.getActiveCompanies().subscribe({next:data=>this.companies=data,error:()=>this.error='No fue posible consultar empresas.'});}
  submit():void {
    if(this.sending)return;this.error='';this.message='';
    if(this.token && (this.password.length<12 || this.password!==this.confirmPassword)){
      this.error='Utiliza al menos 12 caracteres y confirma la contraseña.';return;}
    if(!this.token && (!this.companyId || !this.username.trim())){
      this.error='Selecciona tu empresa e indica tu usuario o correo.';return;}
    this.sending=true;
    const url='https://localhost:7295/api/password-recovery';
    const request=this.token?this.http.post<{message:string}>(`${url}/complete`,{token:this.token,newPassword:this.password}):
      this.http.post<{message:string}>(`${url}/request`,{companyId:this.companyId,usernameOrEmail:this.username.trim()});
    request.subscribe({next:r=>{this.sending=false;this.message=r.message;this.password='';this.confirmPassword='';this.token='';},
      error:e=>{this.sending=false;this.error=String(e.error?.error||'No fue posible procesar la solicitud.');}});
  }
}
