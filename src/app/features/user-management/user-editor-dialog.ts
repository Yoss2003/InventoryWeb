import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Observable, concat } from 'rxjs';

import { ExternalConsultasService } from '../../core/services/external-consultas';
import {
  ManagedRole, ManagedUser, ManagedUserDetails, UserPermissionFlags, UserManagementService
} from '../../core/services/user-management';
import { suggestedUsername } from '../../shared/user-name';
import { ToastService } from '../../shared/toast/toast.service';
import { InventoryDialogMotionDirective } from '../../shared/ui/inv-dialog-motion.directive';

export interface UserEditorDialogData {
  user?: ManagedUser;
  roles: ManagedRole[];
  currentUserId: number;
  canManageIndividualPermissions: boolean;
}

export type UserEditorDialogResult =
  | { kind: 'created'; username: string; personalInventoryId: number; emailSent: boolean; message?: string }
  | { kind: 'updated'; changed: boolean; partialFailure?: boolean };

/** Un mismo asistente de tres pasos para crear y editar usuarios de la empresa del JWT. */
@Component({
  selector: 'app-user-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatFormFieldModule,
    MatSelectModule, InventoryDialogMotionDirective],
  templateUrl: './user-editor-dialog.html',
  styleUrl: './user-editor-dialog.scss'
})
export class UserEditorDialogComponent implements OnInit {
  readonly data = inject<UserEditorDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialogRef<UserEditorDialogComponent, UserEditorDialogResult | null>);
  private readonly api = inject(UserManagementService);
  private readonly external = inject(ExternalConsultasService);
  private readonly toasts = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  step = 1;
  saving = false;
  lookingUpDni = false;
  loadingPermissions = false;
  permissionLoadFailed = false;
  selectedRole = 0;
  effectiveRoleCodes: string[] = [];
  editing: ManagedUserDetails = { username: '', firstName: '', lastName: '', email: '', dni: null };
  permissions: UserPermissionFlags = this.emptyPermissions();
  private originalPermissions: UserPermissionFlags | null = null;

  constructor() {
    const user = this.data.user;
    if (user) {
      this.editing = {
        username: user.username,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email,
        dni: user.dni || null
      };
      this.selectedRole = user.roleId;
    } else {
      this.selectedRole = this.availableRoles[0]?.id || 0;
    }
  }

  get isEdit(): boolean { return !!this.data.user; }
  get availableRoles(): ManagedRole[] {
    return this.data.roles.filter(role => role.id > 2);
  }
  get canChangeRole(): boolean {
    const user = this.data.user;
    return !user || (user.id !== this.data.currentUserId && user.roleId > 2);
  }
  get canChangePermissions(): boolean {
    const user = this.data.user;
    return !!user && this.data.canManageIndividualPermissions &&
      user.id !== this.data.currentUserId && user.roleId > 2 &&
      !this.loadingPermissions && !this.permissionLoadFailed;
  }
  get personalValid(): boolean {
    return !!this.editing.firstName.trim() && !!this.editing.lastName.trim() &&
      this.editing.username.trim().length >= 3 && this.editing.username.length <= 80 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editing.email.trim()) &&
      (!this.editing.dni || /^\d{8}$/.test(this.editing.dni));
  }
  get roleValid(): boolean {
    return !this.canChangeRole || this.availableRoles.some(role => role.id === this.selectedRole);
  }
  get roleLabel(): string {
    if (this.selectedRole === 2) return 'Administrador';
    return this.availableRoles.find(role => role.id === this.selectedRole)?.name || 'Rol protegido';
  }
  get canSubmit(): boolean {
    return !this.saving && this.personalValid && this.roleValid && !this.loadingPermissions;
  }
  get motionWidth(): string {
    const width = this.step === 1 ? 800 : this.step === 2 ? 630 : (this.isEdit ? 760 : 650);
    return 'min(' + width + 'px, calc(100vw - 24px))';
  }

  ngOnInit(): void {
    const user = this.data.user;
    if (!user) return;
    this.loadingPermissions = true;
    this.api.userPermissions(user.id).subscribe({
      next: flags => {
        this.permissions = {
          canApplyDiscounts: flags.canApplyDiscounts,
          canViewPurchaseCosts: flags.canViewPurchaseCosts,
          canCancelSales: flags.canCancelSales,
          canEditProducts: flags.canEditProducts,
          canViewProfits: flags.canViewProfits
        };
        this.originalPermissions = { ...this.permissions };
        this.effectiveRoleCodes = flags.rolePermissions || [];
        this.loadingPermissions = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPermissions = false;
        this.permissionLoadFailed = true;
        this.toasts.warning('No se pudieron consultar los permisos. Podrás guardar los datos personales.');
        this.cdr.markForCheck();
      }
    });
  }

  private emptyPermissions(): UserPermissionFlags {
    return {
      canApplyDiscounts: false, canViewPurchaseCosts: false,
      canCancelSales: false, canEditProducts: false, canViewProfits: false
    };
  }

  onNamesChanged(): void {
    this.editing.username = suggestedUsername(this.editing.firstName, this.editing.lastName);
  }

  goStep(next: number): void {
    if (this.saving || next < 1 || next > 3) return;
    if (next > 1 && !this.personalValid) {
      this.toasts.warning('Completa nombre, apellidos y correo válido antes de continuar.');
      this.step = 1;
      return;
    }
    if (next > 2 && !this.roleValid) {
      this.toasts.warning('Selecciona un rol válido antes de continuar.');
      this.step = 2;
      return;
    }
    this.step = next;
  }

  consultDni(): void {
    const dni = this.editing.dni || '';
    if (!/^\d{8}$/.test(dni) || this.lookingUpDni || this.saving) return;
    this.lookingUpDni = true;
    this.external.dni(dni).subscribe({
      next: response => {
        const names = (response.first_name || '').trim();
        const surnames = [response.first_last_name, response.second_last_name]
          .filter(Boolean).join(' ').trim();
        if (names) this.editing.firstName = names;
        if (surnames) this.editing.lastName = surnames;
        if (names || surnames) this.onNamesChanged();
        this.lookingUpDni = false;
        if (names && surnames) this.toasts.success('Datos del DNI consultados.');
        else this.toasts.warning('Completa los datos que faltan manualmente.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.lookingUpDni = false;
        this.toasts.warning('No se pudo consultar el DNI. Puedes continuar manualmente.');
        this.cdr.markForCheck();
      }
    });
  }

  close(): void {
    if (!this.saving) this.dialog.close(null);
  }

  save(): void {
    if (!this.canSubmit) {
      this.toasts.warning('Revisa los datos obligatorios antes de guardar.');
      return;
    }
    if (this.step !== 3) {
      this.goStep(this.step + 1);
      return;
    }

    const details: ManagedUserDetails = {
      username: this.editing.username.trim(),
      firstName: this.editing.firstName.trim(),
      lastName: this.editing.lastName.trim(),
      email: this.editing.email.trim(),
      dni: this.editing.dni?.trim() || null
    };

    this.saving = true;
    if (!this.data.user) {
      this.api.create({ ...details, roleId: this.selectedRole }).subscribe({
        next: created => {
          this.saving = false;
          this.dialog.close({
            kind: 'created', username: created.username,
            personalInventoryId: created.personalInventoryId,
            emailSent: created.emailSent, message: created.message
          });
        },
        error: error => {
          this.saving = false;
          this.toasts.error(String(error?.error?.error || error?.error?.message ||
            'No se pudo crear el usuario.'));
          this.cdr.markForCheck();
        }
      });
      return;
    }

    const user = this.data.user;
    const initial: ManagedUserDetails = {
      username: user.username, firstName: user.firstName || '',
      lastName: user.lastName || '', email: user.email, dni: user.dni || null
    };
    const operations: Observable<unknown>[] = [];
    if (JSON.stringify(details) !== JSON.stringify(initial)) {
      operations.push(this.api.updateDetails(user.id, details));
    }
    if (this.canChangeRole && this.selectedRole !== user.roleId) {
      operations.push(this.api.updateAccess(user.id, user.isActive, this.selectedRole));
    }
    if (this.canChangePermissions && this.originalPermissions &&
        JSON.stringify(this.permissions) !== JSON.stringify(this.originalPermissions)) {
      operations.push(this.api.saveUserPermissions(user.id, this.permissions));
    }

    if (!operations.length) {
      this.saving = false;
      this.dialog.close({ kind: 'updated', changed: false });
      return;
    }
    // La API tiene endpoints separados. Guardar secuencialmente y refrescar si uno falla.
    concat(...operations).subscribe({
      complete: () => {
        this.saving = false;
        this.dialog.close({ kind: 'updated', changed: true });
      },
      error: error => {
        this.saving = false;
        this.toasts.error(String(error?.error?.error ||
          'No se pudieron completar todos los cambios. Comprueba los datos guardados.'));
        this.dialog.close({ kind: 'updated', changed: true, partialFailure: true });
      }
    });
  }
}
