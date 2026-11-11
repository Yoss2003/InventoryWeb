import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';

import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { UiButtonDirective } from '../../shared/ui/v2/ui-button.directive';
import { UiTableActionDirective } from '../../shared/ui/v2/ui-table-action.directive';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmationDialogService } from '../../shared/confirm-dialog/confirmation-dialog.service';
import { AccessService } from '../../core/services/access';
import {
  ManagedUser, ManagedRole, ManagedUserInput, ManagedUserDetails,
  UserPermissionFlags, UserPermissionSnapshot, PermissionItem,
  UserManagementService
} from '../../core/services/user-management';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, UiPageHeadingComponent,
    UiButtonDirective, UiTableActionDirective],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss'
})
export class UserManagementComponent implements OnInit {
  private readonly api = inject(UserManagementService);
  private readonly access = inject(AccessService);
  private readonly toast = inject(ToastService);
  private readonly confirms = inject(ConfirmationDialogService);

  isDeveloper = false;
  isAdministrator = false;
  get canManageIndividualPermissions(): boolean { return this.isDeveloper || this.isAdministrator; }
  loading = false;
  saving = false;
  error = '';
  filter = '';
  users: ManagedUser[] = [];
  roles: ManagedRole[] = [];
  currentUserId = 0;
  createExpanded = false;

  newUser: ManagedUserInput = this.emptyUser();
  passwordRepeat = '';
  selected: ManagedUser | null = null;
  editing: ManagedUserDetails = this.emptyDetails();
  selectedRole = 0;
  selectedPermissions: UserPermissionFlags = this.emptyPermissions();
  effectiveRoleCodes: string[] = [];
  loadingPermissions = false;

  policyRoles: ManagedRole[] = [];
  policyItems: PermissionItem[] = [];
  policyRoleId = 0;
  selectedPolicyIds = new Set<number>();
  savingPolicy = false;
  policyExpanded = false;

  get filtered(): ManagedUser[] {
    const q = this.filter.trim().toLocaleLowerCase('es');
    return this.users.filter(u => !q ||
      [u.username, u.email, u.firstName, u.lastName, String(u.roleId)]
        .some(v => String(v ?? '').toLocaleLowerCase('es').includes(q)));
  }

  get canCreate(): boolean {
    return !this.saving &&
      this.newUser.username.trim().length >= 3 &&
      this.newUser.firstName.trim().length > 0 &&
      this.newUser.lastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.newUser.email.trim()) &&
      (!this.newUser.dni || /^\d{8}$/.test(this.newUser.dni)) &&
      this.newUser.initialPassword.length >= 12 &&
      this.newUser.initialPassword === this.passwordRepeat &&
      this.roles.some(r => r.id === this.newUser.roleId);
  }

  get canEdit(): boolean {
    return !!this.selected && this.editing.username.trim().length >= 3 &&
      this.editing.firstName.trim().length > 0 &&
      this.editing.lastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editing.email.trim()) &&
      (!this.editing.dni || /^\d{8}$/.test(this.editing.dni));
  }

  private emptyUser(): ManagedUserInput {
    return { username: '', email: '', initialPassword: '',
      firstName: '', lastName: '', dni: null, roleId: 0 };
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
      next: snapshot => {
        this.isDeveloper = snapshot.isDeveloper;
        this.isAdministrator = snapshot.isAdministrator;
        this.currentUserId = snapshot.userId;
        this.reload();
        if (snapshot.isDeveloper) this.loadPolicyDefinitions();
      },
      error: () => { this.error = 'No se pudieron cargar tus permisos.'; }
    });
  }

  reload(): void {
    this.loading = true;
    this.error = '';
    forkJoin({ users: this.api.users(), roles: this.api.roles() }).subscribe({
      next: ({users, roles}) => {
        this.users = users || [];
        this.roles = roles || [];
        if (!this.roles.some(r => r.id === this.newUser.roleId))
          this.newUser.roleId = this.roles[0]?.id ?? 0;
        if (this.selected)
          this.selected = this.users.find(u => u.id === this.selected?.id) || null;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.error = String(err?.error?.error || 'No se pudo cargar la gestión de usuarios.');
      }
    });
  }

  roleName(roleId: number): string {
    if (roleId === 1) return 'Desarrollador';
    if (roleId === 2) return 'Administrador';
    return this.roles.find(r => r.id === roleId)?.name || `Rol #${roleId}`;
  }

  register(): void {
    if (!this.canCreate) return;
    this.saving = true;
    const body: ManagedUserInput = {
      ...this.newUser,
      username: this.newUser.username.trim(),
      firstName: this.newUser.firstName.trim(),
      lastName: this.newUser.lastName.trim(),
      email: this.newUser.email.trim(),
      dni: this.newUser.dni || null
    };
    this.api.create(body).subscribe({
      next: created => {
        this.saving = false;
        this.newUser = this.emptyUser();
        this.passwordRepeat = '';
        this.newUser.roleId = this.roles[0]?.id ?? 0;
        this.createExpanded = false;
        this.toast.success(`Usuario registrado. Inventario personal #${created.personalInventoryId} creado.`);
        this.reload();
      },
      error: err => {
        this.saving = false;
        this.toast.error(String(err?.error?.error || 'No se pudo registrar el usuario.'));
      }
    });
  }

  edit(user: ManagedUser): void {
    if (user.roleId === 1 || (user.roleId === 2 && !this.isDeveloper)) return;
    this.selected = user;
    this.editing = {
      username: user.username, email: user.email,
      firstName: user.firstName || '', lastName: user.lastName || '',
      dni: user.dni || null
    };
    this.selectedRole = user.roleId;
    this.selectedPermissions = this.emptyPermissions();
    this.effectiveRoleCodes = [];
    this.loadingPermissions = true;
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
      },
      error: () => {
        this.loadingPermissions = false;
        this.toast.warning('No se pudieron consultar los permisos individuales.');
      }
    });
  }

  closeEditing(): void { this.selected = null; }

  saveDetails(): void {
    if (!this.selected || !this.canEdit || this.saving) return;
    this.saving = true;
    this.api.updateDetails(this.selected.id, {
      ...this.editing, username: this.editing.username.trim(),
      email: this.editing.email.trim(), firstName: this.editing.firstName.trim(),
      lastName: this.editing.lastName.trim(), dni: this.editing.dni || null
    }).subscribe({
      next: () => { this.saving = false; this.toast.success('Datos del usuario actualizados.'); this.reload(); },
      error: err => { this.saving = false; this.toast.error(String(err?.error?.error || 'No se pudieron guardar los datos.')); }
    });
  }

  saveRole(): void {
    const user = this.selected;
    if (!user || this.saving || user.id === this.currentUserId || user.roleId <= 2 ||
        !this.roles.some(r => r.id === this.selectedRole)) return;
    this.saving = true;
    this.api.updateAccess(user.id, user.isActive, this.selectedRole).subscribe({
      next: () => {
        this.saving = false; this.toast.success('Rol actualizado.');
        this.selected = null; this.reload();
      },
      error: err => { this.saving = false; this.toast.error(String(err?.error?.error || 'No se pudo cambiar el rol.')); }
    });
  }

  savePermissions(): void {
    const user = this.selected;
    if (!user || !this.canManageIndividualPermissions || this.saving ||
        user.id === this.currentUserId || user.roleId <= 2) return;
    this.saving = true;
    this.api.saveUserPermissions(user.id, this.selectedPermissions).subscribe({
      next: () => { this.saving = false; this.toast.success('Permisos individuales actualizados.'); },
      error: err => { this.saving = false; this.toast.error(String(err?.error?.error || 'No se pudieron actualizar los permisos.')); }
    });
  }

  toggleActive(user: ManagedUser): void {
    if (user.id === this.currentUserId || user.roleId <= 2) return;
    this.confirms.confirm({
      title: user.isActive ? 'Desactivar usuario' : 'Reactivar usuario',
      message: `¿${user.isActive ? 'Desactivar' : 'Reactivar'} a «${user.username}»? Sus inventarios y registros históricos se conservarán.`,
      confirmLabel: user.isActive ? 'Desactivar' : 'Reactivar',
      tone: user.isActive ? 'danger' : 'primary',
      icon: user.isActive ? 'block' : 'check_circle'
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.api.updateAccess(user.id, !user.isActive, null).subscribe({
        next: () => { this.toast.success('Estado del usuario actualizado.'); this.reload(); },
        error: err => this.toast.error(String(err?.error?.error || 'No se pudo cambiar el estado.'))
      });
    });
  }

  loadPolicyDefinitions(): void {
    forkJoin({ roles: this.api.globalRoles(), permissions: this.api.globalPermissions() }).subscribe({
      next: ({roles, permissions}) => {
        this.policyRoles = (roles || []).filter(r => r.id > 2);
        this.policyItems = permissions || [];
        this.policyRoleId = this.policyRoles[0]?.id ?? 0;
        this.changePolicyRole(this.policyRoleId);
      },
      error: () => this.toast.warning('No se pudo cargar el editor global de permisos.')
    });
  }

  changePolicyRole(id: number): void {
    this.policyRoleId = Number(id);
    const role = this.policyRoles.find(r => r.id === this.policyRoleId);
    this.selectedPolicyIds = new Set((role?.rolePermissions || []).map(p => p.permissionId));
  }
  hasPolicyPermission(id: number): boolean { return this.selectedPolicyIds.has(id); }
  setPolicyPermission(id: number, checked: boolean): void {
    if (checked) this.selectedPolicyIds.add(id);
    else this.selectedPolicyIds.delete(id);
    this.selectedPolicyIds = new Set(this.selectedPolicyIds);
  }
  saveRolePolicy(): void {
    if (!this.isDeveloper || this.savingPolicy || !this.policyRoles.some(r => r.id === this.policyRoleId))
      return;
    this.confirms.confirm({
      title: 'Actualizar permisos del rol',
      message: 'Los permisos del rol se aplicarán a todos los usuarios que lo tengan asignado. ¿Confirmar?',
      confirmLabel: 'Guardar permisos', tone: 'primary', icon: 'shield'
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.savingPolicy = true;
      this.api.updateRolePermissions(this.policyRoleId, [...this.selectedPolicyIds]).subscribe({
        next: () => { this.savingPolicy = false; this.toast.success('Permisos del rol actualizados.'); this.loadPolicyDefinitions(); },
        error: err => { this.savingPolicy = false; this.toast.error(String(err?.error?.error || 'No se pudieron guardar los permisos del rol.')); }
      });
    });
  }
}
