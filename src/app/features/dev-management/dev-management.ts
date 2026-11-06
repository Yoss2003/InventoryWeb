import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { DevManagementService, DevCompany, CompanyEdit, ResetPending } from '../../core/services/dev-management';

@Component({selector:'app-dev-management',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./dev-management.html',styleUrl:'./dev-management.scss'})
export class DevManagementComponent implements OnInit {
  private readonly api=inject(DevManagementService);
  private readonly router=inject(Router);
  private readonly platform=inject(PLATFORM_ID);
  companies:DevCompany[]=[]; pending:ResetPending[]=[];
  selectedId:number|null=null; loading=false; saving=false; error=''; notice='';
  form:CompanyEdit=this.empty();
  readonly developer=this.isDeveloper();
  ngOnInit():void { if (!this.developer){void this.router.navigate(['/dashboard/articulos']);return;} this.reload(); }
  private isDeveloper():boolean {
    if(!isPlatformBrowser(this.platform))return false;
    try{return Number(JSON.parse(localStorage.getItem('userSession')||'{}').roleId)===1;}catch{return false;}
  }
  private empty():CompanyEdit {return {businessName:'',ruc:'',plan:'Basico',maxUsers:5,
    expiresAt:new Date(Date.now()+30*86400000).toISOString().slice(0,10),licenseEnabled:true,
    primaryColorHex:'#A2D149',logoUrl:null};}
  get editing():boolean{return this.selectedId!=null;}
  daysRemaining(item:DevCompany):number|null {
    return item.license ? Math.ceil((new Date(item.license.expiresAt).getTime()-Date.now())/86400000):null;
  }
  reload():void {
    this.loading=true;this.error='';
    forkJoin({companies:this.api.list(),pending:this.api.pending()}).subscribe({
      next:r=>{this.companies=r.companies;this.pending=r.pending;this.loading=false;},
      error:e=>{this.loading=false;this.error=String(e.error?.error??'No se pudieron cargar los datos de Gestión Dev.');}
    });
  }
  select(row:DevCompany):void {
    this.selectedId=row.id;
    this.form={businessName:row.businessName,ruc:row.ruc,
      plan:row.license?.plan??'Basico',maxUsers:row.license?.maxUsers??5,
      expiresAt:row.license?.expiresAt?.slice(0,10)??this.empty().expiresAt,
      licenseEnabled:row.license?.isEnabled??true,primaryColorHex:row.primaryColorHex,logoUrl:row.logoUrl};
    this.error='';this.notice='';
  }
  newCompany():void {this.selectedId=null;this.form=this.empty();this.error='';this.notice='';}
  save():void {
    if(this.saving)return;
    this.error='';this.notice='';
    if(!this.form.businessName.trim()||!/^\d{11}$/.test(this.form.ruc)||this.form.maxUsers<1||!this.form.expiresAt){
      this.error='Completa nombre, RUC de 11 dígitos, fecha de licencia y límite de usuarios.';return;}
    this.saving=true;
    const body={...this.form,businessName:this.form.businessName.trim(),
      expiresAt:new Date(`${this.form.expiresAt}T23:59:59Z`).toISOString()};
    const req:Observable<unknown>=this.selectedId!=null?this.api.update(this.selectedId,body):this.api.create(body);
    req.subscribe({next:()=>{this.saving=false;this.notice='Empresa y licencia guardadas.';this.newCompany();this.reload();},
      error:e=>{this.saving=false;this.error=String(e.error?.error??'No se pudo guardar la empresa.');}});
  }
  deactivate(row:DevCompany):void {
    if(!confirm(`¿Desactivar ${row.businessName}? Solo se permite si no tiene referencias.`))return;
    this.api.deactivate(row.id).subscribe({next:()=>{this.notice='Empresa desactivada.';this.reload();},
      error:e=>this.error=String(e.error?.error??'La empresa tiene datos relacionados.')});
  }
  review(req:ResetPending,approve:boolean):void {
    if(!confirm(`${approve?'Aprobar':'Rechazar'} recuperación de ${req.username} en ${req.company}?`))return;
    const call:Observable<unknown>=approve?this.api.approve(req.id):this.api.reject(req.id);
    call.subscribe({next:()=>{this.notice=approve?'Solicitud aprobada y correo enviado.':'Solicitud rechazada.';this.reload();},
      error:e=>this.error=String(e.error?.error??'No se pudo procesar la solicitud.')});
  }
}
