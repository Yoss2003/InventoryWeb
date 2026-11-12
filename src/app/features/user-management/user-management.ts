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
import {
  ManagedUser, ManagedRole, UserManagementService
} from '../../core/services/user-management';
import { UserEditorDialogComponent, UserEditorDialogData, UserEditorDialogResult } from './user-editor-dialog';
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
    get canManageIndividualPermissions(): boolean {
    return this.canEditUsers && (this.isDeveloper || this.isAdministrator);
  }
  get filtered(): ManagedUser[] {
    const query = this.filter.trim().toLocaleLowerCase('es');
    return this.users.filter(u => !query ||
      [u.username, u.email, u.firstName, u.lastName, String(u.roleId)]
        .some(v => String(v ?? '').toLocaleLowerCase('es').includes(query)));
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
    const data: UserEditorDialogData = {
      roles: this.roles,
      currentUserId: this.currentUserId,
      canManageIndividualPermissions: this.canManageIndividualPermissions
    };
    this.dialogs.open<UserEditorDialogComponent, UserEditorDialogData, UserEditorDialogResult>(
      UserEditorDialogComponent, {
        data,
        panelClass: 'inv-seven-modal',
        width: 'min(800px, calc(100vw - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        enterAnimationDuration: 260,
        exitAnimationDuration: 220,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: true
      }
    ).afterClosed().subscribe(result => {
      if (!result || result.kind !== 'created') return;
      if (result.emailSent) this.toast.success(
        'Usuario ' + result.username + ' registrado con inventario #' +
        result.personalInventoryId + '. Credenciales enviadas.');
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
    const data: UserEditorDialogData = {
      user,
      roles: this.roles,
      currentUserId: this.currentUserId,
      canManageIndividualPermissions: this.canManageIndividualPermissions
    };
    this.dialogs.open<UserEditorDialogComponent, UserEditorDialogData, UserEditorDialogResult>(
      UserEditorDialogComponent, {
        data,
        panelClass: 'inv-seven-modal',
        width: 'min(800px, calc(100vw - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        enterAnimationDuration: 260,
        exitAnimationDuration: 220,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: true
      }
    ).afterClosed().subscribe(result => {
      if (!result || result.kind !== 'updated') return;
      if (result.changed && !result.partialFailure) this.toast.success('Usuario actualizado correctamente.');
      if (result.changed) this.reload();
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
