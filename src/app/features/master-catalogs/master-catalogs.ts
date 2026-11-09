import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SupplierDetailDialogComponent } from './supplier-detail-dialog';
import { InventoryContextService } from '../../core/services/inventory-context';
import { ToastService } from '../../shared/toast/toast.service';

export interface SupplierRecord {
  id: number; inventoryId: number; companyId: number; ruc: string; businessName: string;
  contactName?: string | null; phone?: string | null; email?: string | null;
  address?: string | null; statusId: number; isActive: boolean; reused?: boolean;
  // FASE 4.1.2: datos persistentes de la relación comercial y consulta fiscal
  relationshipDescription?: string | null; fiscalDataJson?: string | null;
  // FASE 4.1 RUC AVANZADO: campos ya almacenables en Suppliers
  estado?: string | null; condicion?: string | null;
  distrito?: string | null; provincia?: string | null; departamento?: string | null;
  // Datos avanzados solo informativos; la API no los persiste todavía.
  advancedDataAvailable?: boolean; lookupFromCache?: boolean;
  ubigeo?: string | null; tipoContribuyente?: string | null;
  actividadEconomica?: string | null; numeroTrabajadores?: string | null;
  tipoFacturacion?: string | null; tipoContabilidad?: string | null;
  comercioExterior?: string | null;
}
interface ParameterRecord {
  id: number; inventoryId: number; companyId: number; parameterType: string;
  name: string; description?: string | null; reused?: boolean;
}

import { UiSearchComponent } from '../../shared/ui/ui-search.component';

@Component({
  selector: 'app-master-catalogs', standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, UiSearchComponent],
  templateUrl: './master-catalogs.html', styleUrl: './master-catalogs.scss'
})
export class MasterCatalogsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly inventories = inject(InventoryContextService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  /* FASE 4.1 */
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiRoot = 'https://localhost:7295/api';
  tab: 'suppliers' | 'parameters' = 'suppliers';
  suppliers: SupplierRecord[] = [];
  parameters: ParameterRecord[] = [];
  supplierSearch = '';
  parameterSearch = '';
  get filteredSuppliers(): SupplierRecord[] {
    const q = this.supplierSearch.trim().toLocaleLowerCase('es');
    return !q ? this.suppliers : this.suppliers.filter(x =>
      [x.ruc, x.businessName, x.contactName, x.email, x.estado]
        .some(value => String(value ?? '').toLocaleLowerCase('es').includes(q)));
  }
  get filteredParameters(): ParameterRecord[] {
    const q = this.parameterSearch.trim().toLocaleLowerCase('es');
    return !q ? this.parameters : this.parameters.filter(x =>
      [x.parameterType, x.name, x.description]
        .some(value => String(value ?? '').toLocaleLowerCase('es').includes(q)));
  }
  loading = false;
  saving = false;
  lookupRucLoading = false;
  advancedInfo: Partial<SupplierRecord> | null = null;
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
    return {id:0,inventoryId:0,companyId:0,ruc:'',businessName:'',contactName:'',phone:'',email:'',address:'',relationshipDescription:'',fiscalDataJson:null,statusId:1,isActive:true};
  }
  private emptyParameter(): ParameterRecord {
    return {id:0,inventoryId:0,companyId:0,parameterType:'',name:'',description:''};
  }
  refresh(): void {
    if (this.loading) return;
    this.loading = true;
    this.http.get<SupplierRecord[]>(`${this.apiRoot}/Suppliers`).subscribe({
      next: list => {this.suppliers = list || [];this.loading = false;this.cdr.markForCheck();},
      error: () => {this.loading = false;this.toast.error('No se pudieron consultar los proveedores.');this.cdr.markForCheck();}
    });
    this.http.get<ParameterRecord[]>(`${this.apiRoot}/Parameters`).subscribe({
      next: list => {this.parameters = list || [];this.cdr.markForCheck();},
      error: () => this.toast.error('No se pudieron consultar los parámetros generales.')
    });
  }
  lookupRuc(): void {
    const ruc = String(this.supplier.ruc ?? '').trim();
    if (!/^\d{11}$/.test(ruc)) { this.toast.warning('El RUC debe tener 11 dígitos.'); return; }
    if (this.lookupRucLoading || this.saving) return;
    this.lookupRucLoading = true;
    this.advancedInfo = null;
    this.cdr.markForCheck();
    this.http.get<Partial<SupplierRecord>>(`${this.apiRoot}/Suppliers/ruc/${encodeURIComponent(ruc)}`).subscribe({
      next: result => {
        this.lookupRucLoading = false;
        if (String(this.supplier.ruc).trim() !== ruc) { this.cdr.markForCheck(); return; }
        this.supplier = {
          ...this.supplier,
          businessName: result.businessName || this.supplier.businessName,
          address: result.address?.trim() || this.supplier.address,
          statusId: result.statusId || this.supplier.statusId,
          estado: result.estado ?? this.supplier.estado,
          condicion: result.condicion ?? this.supplier.condicion,
          distrito: result.distrito ?? this.supplier.distrito,
          provincia: result.provincia ?? this.supplier.provincia,
          departamento: result.departamento ?? this.supplier.departamento,
          fiscalDataJson: result.fiscalDataJson ?? this.supplier.fiscalDataJson
        };
        this.advancedInfo = result.advancedDataAvailable ? result : null;
        if (result.lookupFromCache)
          this.toast.warning('Decolecta no respondió. Se mostraron datos previamente guardados en esta empresa.', 'Datos en caché');
        else if (result.advancedDataAvailable)
          this.toast.success('Consulta avanzada realizada. Revisa la información fiscal y completa los datos de contacto.', 'Datos SUNAT');
        else
          this.toast.info('La consulta básica funcionó, pero la avanzada no está disponible con este acceso.', 'Datos SUNAT');
        this.cdr.markForCheck();
      },
      error: err => {
        this.lookupRucLoading = false;
        this.toast.error(String(err?.error?.error ?? 'No se pudo consultar el RUC en Decolecta.'));
        this.cdr.markForCheck();
      }
    });
  }
  newSupplier(): void {this.supplier=this.emptySupplier();this.editingSupplierId=null;this.advancedInfo=null;}
  // FASE 4.1.2: vista de detalles sin permisos de escritura.
  showSupplierDetail(item: SupplierRecord): void {
    this.dialog.open(SupplierDetailDialogComponent, {
      data: {...item},
      width: 'min(760px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      autoFocus: false
    });
  }
  editSupplier(item: SupplierRecord): void {if (!this.canManage) return;this.advancedInfo=null;this.supplier={...item};this.editingSupplierId=item.id;this.tab='suppliers';}
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
