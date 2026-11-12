import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';

import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { UiButtonDirective } from '../../shared/ui/v2/ui-button.directive';
import { UiTableActionDirective } from '../../shared/ui/v2/ui-table-action.directive';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmationDialogService } from '../../shared/confirm-dialog/confirmation-dialog.service';
import { AccessService } from '../../core/services/access';
import { suggestedUsername } from '../../shared/user-name';
import {
  ManagedUser, ManagedRole, ManagedUserDetails, UserPermissionFlags,
  UserManagementService
} from '../../core/services/user-management';
import {
  FirstAdminDialogComponent, FirstAdminCreated
} from '../dev-management/first-admin-dialog';
import { RolePermissionsDialogComponent } from './role-permissions-dialog';
import { ResendCredentialsDialogComponent } from './resend-credentials-dialog';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule,
    UiPageHeadingComponent, UiButtonDirective, UiTableActionDirective],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss'
})
export class UserManagementComponent implements OnInit {
  private readonly api = inject(UserManagementService);
  private readonly access = inject(AccessService);
  private readonly toast = inject(ToastService);
  private readonly confirms = inject(ConfirmationDialogService);
  private readonly dialogs = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  isDeveloper = false;
  isAdministrator = false;
  canEditUsers = false;
  companyId = 0;
  currentUserId = 0;
  loading = false;
  saving = false;
  error = '';
  filter = '';
  users: ManagedUser[] = [];
  roles: ManagedRole[] = [];

  selected: ManagedUser | null = null;
  editing: ManagedUserDetails = this.emptyDetails();
  selectedRole = 0;
  selectedPermissions: UserPermissionFlags = this.emptyPermissions();
  effectiveRoleCodes: string[] = [];
  loadingPermissions = false;

  get canManageIndividualPermissions(): boolean {
    return this.canEditUsers && (this.isDeveloper || this.isAdministrator);
  }
  get filtered(): ManagedUser[] {
    const query = this.filter.trim().toLocaleLowerCase('es');
    return this.users.filter(u => !query ||
      [u.username, u.email, u.firstName, u.lastName, String(u.roleId)]
        .some(v => String(v ?? '').toLocaleLowerCase('es').includes(query)));
  }
  private emptyDetails(): ManagedUserDetails {
    return { username: '', email: '', firstName: '', lastName: '', dni: null };
  }
  private emptyPermissions(): UserPermissionFlags {
    return { canApplyDiscounts: false, canViewPurchaseCosts: false,
      canCancelSales: false, canEditProducts: false, canViewProfits: false };
  }

  ngOnInit(): void {
    this.access.me().subscribe({
      next: info => {
        this.isDeveloper = info.isDeveloper || info.roleId === 1;
        this.isAdministrator = info.isAdministrator || info.roleId === 2;
        this.companyId = info.companyId;
        this.currentUserId = info.userId;
        this.canEditUsers = this.isDeveloper ||
          (this.isAdministrator && (info.permissions || []).includes('MANAGE_USERS'));
        this.reload();
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron comprobar los permisos de la sesión.';
        this.cdr.markForCheck();
      }
    });
  }

  reload(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    forkJoin({ users: this.api.users(), roles: this.api.roles() }).subscribe({
      next: ({users, roles}) => {
        this.users = users || [];
        this.roles = (roles || []).filter(role => role.id > 2);
        if (this.selected)
          this.selected = this.users.find(u => u.id === this.selected?.id) || null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.error = String(error?.error?.error ||
          'No se pudieron cargar los usuarios y roles de esta empresa.');
        this.cdr.markForCheck();
      }
    });
  }

  roleName(roleId: number): string {
    if (roleId === 1) return 'Desarrollador';
    if (roleId === 2) return 'Administrador';
    return this.roles.find(role => role.id === roleId)?.name || `Rol #${roleId}`;
  }

  openNewUser(): void {
    if (!this.canEditUsers) return;
    this.dialogs.open<FirstAdminDialogComponent, unknown, FirstAdminCreated>(
      FirstAdminDialogComponent, {
        data: {
          companyId: this.companyId,
          companyName: 'Empresa actual',
          firstAdministrator: false,
          roles: this.roles
        },
        panelClass: 'inv-seven-modal',
        width: 'min(710px, calc(100vw - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        enterAnimationDuration: 260,
        exitAnimationDuration: 220,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: true
      }
    ).afterClosed().subscribe(result => {
      if (!result) return;
      if (result.emailSent) this.toast.success(
        `Usuario ${result.username} registrado con inventario #${result.personalInventoryId}. Credenciales enviadas.`);
      else this.toast.warning(result.message ||
        'Cuenta creada, pero no se confirmó el correo. Corrige la dirección y reenvía las credenciales.');
      this.reload();
    });
  }

  openRolePermissions(): void {
    if (!this.isDeveloper) return;
    this.dialogs.open(RolePermissionsDialogComponent, {
      panelClass: 'inv-seven-modal',
      width: 'min(800px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      enterAnimationDuration: 260,
      exitAnimationDuration: 220,
      restoreFocus: true,
      autoFocus: 'first-tabbable'
    }).afterClosed().subscribe(saved => {
      if (saved) this.toast.success('Permisos del rol actualizados.');
    });
  }

  resendCredentials(user: ManagedUser): void {
    if (!this.canEditUsers || user.id === this.currentUserId ||
        user.roleId === 1 || (user.roleId === 2 && !this.isDeveloper)) return;
    this.dialogs.open(ResendCredentialsDialogComponent, {
      data: user,
      panelClass: 'inv-seven-modal',
      width: 'min(500px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      enterAnimationDuration: 260,
      exitAnimationDuration: 220,
      restoreFocus: true,
      autoFocus: 'first-tabbable',
      disableClose: true
    }).afterClosed().subscribe(sent => {
      if (sent) this.toast.success(
        'Credenciales nuevas enviadas; la clave anterior ha sido invalidada.');
      // Releer aunque el correo haya fallado: el email corregido se pudo guardar.
      this.reload();
    });
  }

  edit(user: ManagedUser): void {
    if (!this.canEditUsers || user.roleId === 1 ||
        (user.roleId === 2 && !this.isDeveloper)) return;
    this.selected = user;
    this.editing = {
      username: user.username,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      dni: user.dni || null
    };
    this.selectedRole = user.roleId;
    this.selectedPermissions = this.emptyPermissions();
    this.effectiveRoleCodes = [];
    this.loadingPermissions = true;
    this.cdr.markForCheck();
    this.api.userPermissions(user.id).subscribe({
      next: flags => {
        this.selectedPermissions = {
          canApplyDiscounts: flags.canApplyDiscounts,
          canViewPurchaseCosts: flags.canViewPurchaseCosts,
          canCancelSales: flags.canCancelSales,
          canEditProducts: flags.canEditProducts,
          canViewProfits: flags.canViewProfits
        };
        this.effectiveRoleCodes = flags.rolePermissions || [];
        this.loadingPermissions = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPermissions = false;
        this.toast.warning('No se pudieron consultar los permisos individuales.');
        this.cdr.markForCheck();
      }
    });
  }
  updateUsername(): void {
    this.editing.username = suggestedUsername(this.editing.firstName, this.editing.lastName);
  }
  closeEditing(): void { this.selected = null; this.cdr.markForCheck(); }

  get canEditDetails(): boolean {
    return this.canEditUsers && !!this.selected && this.editing.username.length >= 3 &&
      !!this.editing.firstName.trim() && !!this.editing.lastName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editing.email.trim()) &&
      (!this.editing.dni || /^\d{8}$/.test(this.editing.dni));
  }

  saveDetails(): void {
    if (!this.selected || !this.canEditDetails || this.saving) return;
    this.saving = true;
    this.api.updateDetails(this.selected.id, {
      ...this.editing,
      email: this.editing.email.trim(),
      firstName: this.editing.firstName.trim(),
      lastName: this.editing.lastName.trim(),
      dni: this.editing.dni || null
    }).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Datos del usuario actualizados.');
        this.reload();
      },
      error: e => {
        this.saving = false;
        this.toast.error(String(e?.error?.error || 'No se pudieron guardar los cambios.'));
        this.cdr.markForCheck();
      }
    });
  }

  saveRole(): void {
    const user = this.selected;
    if (!user || !this.canEditUsers || this.saving ||
        user.id === this.currentUserId || user.roleId <= 2 ||
        !this.roles.some(r => r.id === this.selectedRole)) return;
    this.saving = true;
    this.api.updateAccess(user.id, user.isActive, this.selectedRole).subscribe({
      next: () => { this.saving = false; this.selected = null; this.toast.success('Rol actualizado.'); this.reload(); },
      error: e => {
        this.saving = false;
        this.toast.error(String(e?.error?.error || 'No se pudo cambiar el rol.'));
        this.cdr.markForCheck();
      }
    });
  }

  savePermissions(): void {
    const user = this.selected;
    if (!user || !this.canManageIndividualPermissions || this.saving ||
        user.id === this.currentUserId || user.roleId <= 2) return;
    this.saving = true;
    this.api.saveUserPermissions(user.id, this.selectedPermissions).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Permisos individuales actualizados.');
        this.cdr.markForCheck();
      },
      error: e => {
        this.saving = false;
        this.toast.error(String(e?.error?.error || 'No se pudieron actualizar los permisos.'));
        this.cdr.markForCheck();
      }
    });
  }

  toggleActive(user: ManagedUser): void {
    if (!this.canEditUsers || user.id === this.currentUserId || user.roleId <= 2) return;
    this.confirms.confirm({
      title: user.isActive ? 'Desactivar usuario' : 'Reactivar usuario',
      message: `¿${user.isActive ? 'Desactivar' : 'Reactivar'} a «${user.username}»? Se conservan sus inventarios e historial.`,
      confirmLabel: user.isActive ? 'Desactivar' : 'Reactivar',
      tone: user.isActive ? 'danger' : 'primary',
      icon: user.isActive ? 'block' : 'check_circle'
    }).subscribe(ok => {
      if (!ok) return;
      this.api.updateAccess(user.id, !user.isActive).subscribe({
        next: () => { this.toast.success('Estado actualizado.'); this.reload(); },
        error: e => this.toast.error(String(e?.error?.error || 'No se pudo actualizar el estado.'))
      });
    });
  }
}
