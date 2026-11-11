import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { UiButtonDirective } from '../../shared/ui/v2/ui-button.directive';
import { UiTableActionDirective } from '../../shared/ui/v2/ui-table-action.directive';
import { ConfirmationDialogService } from '../../shared/confirm-dialog/confirmation-dialog.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AccessService } from '../../core/services/access';
import { InventoryService, InventorySummary, InventoryShare } from '../../core/services/inventories';
import { UserManagementService, ManagedUser } from '../../core/services/user-management';

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink,
    UiPageHeadingComponent, UiButtonDirective, UiTableActionDirective],
  templateUrl: './inventory-management.html',
  styleUrl: './inventory-management.scss'
})
export class InventoryManagementComponent implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly usersApi = inject(UserManagementService);
  private readonly access = inject(AccessService);
  private readonly toast = inject(ToastService);
  private readonly confirms = inject(ConfirmationDialogService);

  isManager = false;
  canCreate = false;
  canManageAccess = false;
  selfId = 0;
  loading = false;
  saving = false;
  error = '';
  rows: InventorySummary[] = [];
  users: ManagedUser[] = [];

  name = '';
  alias = '';
  ownerId = 0;
  editId: number | null = null;
  editName = '';
  editAlias = '';
  sharing: InventorySummary | null = null;
  shares: InventoryShare[] = [];
  shareWith = '';
  shareMode: 1 | 2 = 1;
  sharingBusy = false;

  get operational(): InventorySummary[] {
    return this.rows.filter(r => !r.isMaster);
  }
  get canSubmit(): boolean {
    return this.canCreate && !this.saving && this.name.trim().length > 0 &&
      this.name.trim().length <= 255 &&
      (!this.isManager || this.ownerId > 0);
  }

  ngOnInit(): void {
    this.access.me().subscribe({
      next: a => {
        this.selfId = a.userId;
        this.isManager = a.isDeveloper || a.isAdministrator;
        this.canCreate = (a.permissions || []).includes('CREATE_INVENTORIES');
        this.canManageAccess = (a.permissions || []).includes('MANAGE_INVENTORY_ACCESS');
        this.ownerId = a.userId;
        this.load();
      },
      error: () => { this.error = 'No se pudieron verificar los permisos de la sesión.'; }
    });
  }

  load(): void {
    this.loading = true;
    const members = this.isManager ? this.usersApi.users() : of([] as ManagedUser[]);
    // La administración ve metadatos de la empresa, sin otorgar acceso
    // implícito a los artículos/stock privado de cada empleado.
    const inventories = this.isManager ? this.api.companyInventories() : this.api.getInventories();
    forkJoin({ inventories, users: members }).subscribe({
      next: ({inventories, users}) => {
        this.rows = (inventories || []).filter(i => i.isActive);
        this.users = (users || []).filter(u => u.isActive && u.statusId === 1);
        if (this.isManager && !this.users.some(u => u.id === this.ownerId))
          this.ownerId = this.users[0]?.id ?? 0;
        this.loading = false;
      },
      error: e => {
        this.loading = false;
        this.error = String(e?.error?.error || 'No se pudieron cargar inventarios y usuarios.');
      }
    });
  }
  ownerName(id: number): string {
    return this.users.find(x => x.id === id)?.username ||
      (id === this.selfId ? 'Mi cuenta' : `Usuario #${id}`);
  }

  create(): void {
    if (!this.canSubmit) return;
    this.saving = true;
    const request = this.isManager
      ? this.api.assign(this.ownerId, this.name.trim(), this.alias.trim() || null)
      : this.api.create(this.name.trim(), this.alias.trim() || null);
    request.subscribe({
      next: inventory => {
        this.saving = false;
        this.name = '';
        this.alias = '';
        this.toast.success(`Inventario #${inventory.id} creado. Recarga la aplicación para seleccionarlo en la barra superior.`);
        this.load();
      },
      error: e => { this.saving = false; this.toast.error(String(e?.error?.error || 'No se pudo crear el inventario.')); }
    });
  }
  manageShares(row: InventorySummary): void {
    if (!this.canManageAccess) return;
    this.sharing = row;
    this.shares = [];
    this.shareWith = '';
    this.loadShares();
  }
  loadShares(): void {
    if (!this.sharing) return;
    this.api.getShares(this.sharing.id).subscribe({
      next: result => { this.shares = result || []; },
      error: err => this.toast.error(String(err?.error?.error || 'No se pudieron consultar los accesos.'))
    });
  }
  saveShare(): void {
    if (!this.sharing || !this.canManageAccess || this.sharingBusy || !this.shareWith.trim()) return;
    this.sharingBusy = true;
    this.api.share(this.sharing.id, this.shareWith.trim(), this.shareMode).subscribe({
      next: () => {
        this.sharingBusy = false;
        this.shareWith = '';
        this.toast.success('Acceso compartido correctamente.');
        this.loadShares();
      },
      error: err => {
        this.sharingBusy = false;
        this.toast.error(String(err?.error?.error || 'No se pudo compartir el inventario.'));
      }
    });
  }
  revokeShare(item: InventoryShare): void {
    if (!this.sharing || !this.canManageAccess) return;
    this.confirms.confirm({
      title: 'Revocar acceso',
      message: `¿Revocar el acceso de ${item.username || 'este usuario'}? El inventario y su historial se conservarán.`,
      confirmLabel: 'Revocar acceso', tone: 'danger', icon: 'person_remove'
    }).subscribe(ok => {
      if (!ok) return;
      this.api.revoke(item.id).subscribe({
        next: () => { this.toast.success('Acceso revocado.'); this.loadShares(); },
        error: err => this.toast.error(String(err?.error?.error || 'No se pudo revocar el acceso.'))
      });
    });
  }

  edit(row: InventorySummary): void {
    if (!this.canCreate) return;
    this.editId = row.id;
    this.editName = row.inventoryName;
    this.editAlias = row.alias || '';
  }
  saveEdit(): void {
    const row = this.operational.find(x => x.id === this.editId);
    if (!row || !this.editName.trim() || this.saving) return;
    this.saving = true;
    this.api.update(row, this.editName.trim(), this.editAlias.trim() || null).subscribe({
      next: () => {
        this.saving = false;
        this.editId = null;
        this.toast.success('Inventario actualizado.');
        this.load();
      },
      error: e => { this.saving = false; this.toast.error(String(e?.error?.error || 'No se pudo actualizar el inventario.')); }
    });
  }
  deactivate(row: InventorySummary): void {
    if (!this.canCreate) return;
    this.confirms.confirm({
      title: 'Desactivar inventario',
      message: `¿Desactivar «${row.alias || row.inventoryName}»? No debe tener artículos, movimientos, asignaciones ni accesos compartidos pendientes.`,
      confirmLabel: 'Desactivar',
      tone: 'danger', icon: 'inventory_2'
    }).subscribe(ok => {
      if (!ok) return;
      this.api.deactivate(row.id).subscribe({
        next: () => { this.toast.success('Inventario desactivado.'); this.load(); },
        error: e => this.toast.error(String(e?.error?.error || 'No se puede desactivar ese inventario.'))
      });
    });
  }
}
