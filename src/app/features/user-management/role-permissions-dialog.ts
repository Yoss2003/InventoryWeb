import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import {
  ManagedRole, PermissionItem, UserManagementService
} from '../../core/services/user-management';
import { ConfirmationDialogService } from '../../shared/confirm-dialog/confirmation-dialog.service';

@Component({
  selector: 'app-role-permissions-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule,
    MatFormFieldModule, MatSelectModule],
  templateUrl: './role-permissions-dialog.html',
  styleUrl: './role-permissions-dialog.scss'
})
export class RolePermissionsDialogComponent {
  private readonly api = inject(UserManagementService);
  private readonly ref = inject(MatDialogRef<RolePermissionsDialogComponent, boolean>);
  private readonly confirms = inject(ConfirmationDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  roles: ManagedRole[] = [];
  permissions: PermissionItem[] = [];
  roleId = 0;
  selectedIds = new Set<number>();
  loading = true;
  saving = false;
  error = '';

  constructor() { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({ roles: this.api.globalRoles(), permissions: this.api.globalPermissions() }).subscribe({
      next: ({roles, permissions}) => {
        this.roles = (roles || []).filter(r => r.id >= 2);
        this.permissions = permissions || [];
        if (!this.roles.some(r => r.id === this.roleId))
          this.roleId = this.roles[0]?.id ?? 0;
        this.selectRole(this.roleId);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: e => {
        this.loading = false;
        this.error = String(e?.error?.error || 'No se pudieron consultar roles o permisos.');
        this.cdr.markForCheck();
      }
    });
  }

  selectRole(value: number): void {
    this.roleId = Number(value);
    const role = this.roles.find(x => x.id === this.roleId);
    this.selectedIds = new Set((role?.rolePermissions || []).map(p => p.permissionId));
    this.cdr.markForCheck();
  }

  toggle(id: number, checked: boolean): void {
    const next = new Set(this.selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds = next;
  }

  save(): void {
    if (this.saving || this.roleId < 2) return;
    this.confirms.confirm({
      title: 'Actualizar permisos del rol',
      message: 'Los cambios afectarán a todos los usuarios que tengan asignado este rol. ¿Continuar?',
      confirmLabel: 'Guardar permisos',
      tone: 'primary', icon: 'shield'
    }).subscribe(ok => {
      if (!ok) return;
      this.saving = true;
      this.error = '';
      this.api.updateRolePermissions(this.roleId, [...this.selectedIds]).subscribe({
        next: () => { this.saving = false; this.ref.close(true); },
        error: e => {
          this.saving = false;
          this.error = String(e?.error?.error || e?.error?.message ||
            'No se pudieron actualizar los permisos.');
          this.cdr.markForCheck();
        }
      });
    });
  }

  close(): void { if (!this.saving) this.ref.close(false); }
}
