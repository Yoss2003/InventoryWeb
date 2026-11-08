import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { InventoryContextService } from '../../core/services/inventory-context';
import { ToastService } from '../../shared/toast/toast.service';

interface SupplierRecord {
  id: number; inventoryId: number; companyId: number; ruc: string; businessName: string;
  contactName?: string | null; phone?: string | null; email?: string | null;
  address?: string | null; statusId: number; isActive: boolean; reused?: boolean;
}
interface ParameterRecord {
  id: number; inventoryId: number; companyId: number; parameterType: string;
  name: string; description?: string | null; reused?: boolean;
}

@Component({
  selector: 'app-master-catalogs', standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './master-catalogs.html', styleUrl: './master-catalogs.scss'
})
export class MasterCatalogsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly inventories = inject(InventoryContextService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiRoot = 'https://localhost:7295/api';
  tab: 'suppliers' | 'parameters' = 'suppliers';
  suppliers: SupplierRecord[] = [];
  parameters: ParameterRecord[] = [];
  loading = false;
  saving = false;
  editingSupplierId: number | null = null;
  editingParameterId: number | null = null;
  supplier: SupplierRecord = this.emptySupplier();
  parameter: ParameterRecord = this.emptyParameter();

  get canManage(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try { return [1, 2].includes(Number(JSON.parse(localStorage.getItem('userSession') || '{}').roleId)); }
    catch { return false; }
  }
  ngOnInit(): void { this.refresh(); }
  private emptySupplier(): SupplierRecord {
    return {id:0,inventoryId:0,companyId:0,ruc:'',businessName:'',contactName:'',phone:'',email:'',address:'',statusId:1,isActive:true};
  }
  private emptyParameter(): ParameterRecord {
    return {id:0,inventoryId:0,companyId:0,parameterType:'',name:'',description:''};
  }
  refresh(): void {
    if (this.loading) return;
    this.loading = true;
    this.http.get<SupplierRecord[]>(`${this.apiRoot}/Suppliers`).subscribe({
      next: list => {this.suppliers = list || [];this.loading = false;},
      error: () => {this.loading = false;this.toast.error('No se pudieron consultar los proveedores.');}
    });
    this.http.get<ParameterRecord[]>(`${this.apiRoot}/Parameters`).subscribe({
      next: list => this.parameters = list || [],
      error: () => this.toast.error('No se pudieron consultar los parámetros generales.')
    });
  }
  newSupplier(): void {this.supplier=this.emptySupplier();this.editingSupplierId=null;}
  editSupplier(item: SupplierRecord): void {if (!this.canManage) return;this.supplier={...item};this.editingSupplierId=item.id;this.tab='suppliers';}
  saveSupplier(): void {
    const ruc=String(this.supplier.ruc).trim();
    const businessName=String(this.supplier.businessName).trim();
    if (!/^\d{11}$/.test(ruc) || !businessName) {this.toast.warning('Ingresa un RUC de 11 dígitos y la razón social.');return;}
    const inventoryId=this.inventories.activeInventoryId;
    if (!inventoryId) {this.toast.warning('Selecciona un inventario personal o compartido.');return;}
    this.saving=true;
    const payload={...this.supplier,ruc,businessName,inventoryId};
    const req: Observable<SupplierRecord | void> = this.editingSupplierId
      ? this.http.put<void>(`${this.apiRoot}/Suppliers/${this.editingSupplierId}`,payload)
      : this.http.post<SupplierRecord>(`${this.apiRoot}/Suppliers`,payload);
    req.subscribe({
      next: item => {
        this.saving=false;
        if (item && typeof item==='object' && 'reused' in item && item.reused)
          this.toast.info('El proveedor ya estaba registrado. Se reutilizó el mismo ID.','Proveedor existente');
        else this.toast.success(this.editingSupplierId?'Proveedor actualizado.':'Proveedor incorporado al catálogo maestro.');
        this.newSupplier();this.refresh();
      },
      error: err => {this.saving=false;this.toast.error(String(err?.error?.error||'No fue posible guardar el proveedor.'));}
    });
  }
  disableSupplier(item: SupplierRecord): void {
    if (!this.canManage || !confirm(`¿Desactivar al proveedor ${item.businessName}?`))return;
    this.http.delete<void>(`${this.apiRoot}/Suppliers/${item.id}`).subscribe({
      next:()=>{this.toast.success('Proveedor desactivado.');this.refresh();},
      error:err=>this.toast.error(String(err?.error?.error||'No se pudo desactivar el proveedor.'))
    });
  }
  newParameter(): void {this.parameter=this.emptyParameter();this.editingParameterId=null;}
  editParameter(item: ParameterRecord): void {if (!this.canManage)return;this.parameter={...item};this.editingParameterId=item.id;this.tab='parameters';}
  saveParameter(): void {
    if (!this.parameter.parameterType.trim() || !this.parameter.name.trim()){
      this.toast.warning('Indica el tipo y el nombre del parámetro.');return;
    }
    const inventoryId=this.inventories.activeInventoryId;
    if (!inventoryId) {this.toast.warning('Selecciona un inventario de trabajo.');return;}
    this.saving=true;
    const payload={...this.parameter,inventoryId};
    const req: Observable<ParameterRecord | void> = this.editingParameterId
      ? this.http.put<void>(`${this.apiRoot}/Parameters/${this.editingParameterId}`,payload)
      : this.http.post<ParameterRecord>(`${this.apiRoot}/Parameters`,payload);
    req.subscribe({
      next: item => {
        this.saving=false;
        if (item && typeof item==='object' && 'reused' in item && item.reused)
          this.toast.info('Este parámetro ya existe. Se reutilizó su ID.','Parámetro existente');
        else this.toast.success(this.editingParameterId?'Parámetro actualizado.':'Parámetro creado en el maestro.');
        this.newParameter();this.refresh();
      },
      error:err=>{this.saving=false;this.toast.error(String(err?.error?.error||'No fue posible guardar el parámetro.'));}
    });
  }
  deleteParameter(item: ParameterRecord): void {
    if(!this.canManage || !confirm(`¿Eliminar el parámetro ${item.name}?`))return;
    this.http.delete<void>(`${this.apiRoot}/Parameters/${item.id}`).subscribe({
      next:()=>{this.toast.success('Parámetro eliminado.');this.refresh();},
      error:err=>this.toast.error(String(err?.error?.error||'No se pudo eliminar el parámetro.'))
    });
  }
}
