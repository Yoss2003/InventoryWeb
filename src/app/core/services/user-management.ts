import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  roleId: number;
  companyId: number;
  isActive: boolean;
  statusId: number;
  firstName?: string | null;
  lastName?: string | null;
  dni?: string | null;
  personalInventoryId?: number | null;
}
export interface ManagedRole {
  id: number;
  name: string;
  description?: string;
  rolePermissions?: { id: number; roleId: number; permissionId: number }[];
}
export interface ManagedUserInput {
  username: string;
  email: string;
  initialPassword: string;
  firstName: string;
  lastName: string;
  dni: string | null;
  roleId: number;
}
export interface ManagedUserDetails {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string | null;
}
export interface UserPermissionFlags {
  canApplyDiscounts: boolean;
  canViewPurchaseCosts: boolean;
  canCancelSales: boolean;
  canEditProducts: boolean;
  canViewProfits: boolean;
}
export interface UserPermissionSnapshot extends UserPermissionFlags {
  rolePermissions: string[];
}
export interface PermissionItem { id: number; name: string; systemCode: string; }

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly http = inject(HttpClient);
  private readonly root = 'https://localhost:7295/api';

  users() { return this.http.get<ManagedUser[]>(`${this.root}/UserManagement/users`); }
  roles() { return this.http.get<ManagedRole[]>(`${this.root}/UserManagement/roles`); }
  create(input: ManagedUserInput) {
    return this.http.post<ManagedUser & { personalInventoryId: number }>(
      `${this.root}/UserManagement/users`, input);
  }
  updateDetails(id: number, input: ManagedUserDetails) {
    return this.http.patch<void>(`${this.root}/UserManagement/users/${id}/details`, input);
  }
  updateAccess(id: number, isActive: boolean, roleId: number | null = null) {
    return this.http.patch<void>(`${this.root}/UserManagement/users/${id}/access`, { isActive, roleId });
  }
  userPermissions(id: number) {
    return this.http.get<UserPermissionSnapshot>(`${this.root}/UserManagement/users/${id}/permissions`);
  }
  saveUserPermissions(id: number, input: UserPermissionFlags) {
    return this.http.put<void>(`${this.root}/UserManagement/users/${id}/permissions`, input);
  }
  globalPermissions() { return this.http.get<PermissionItem[]>(`${this.root}/Permissions`); }
  globalRoles() { return this.http.get<ManagedRole[]>(`${this.root}/Roles`); }
  updateRolePermissions(roleId: number, permissionIds: number[]) {
    return this.http.post<{message: string}>(`${this.root}/Roles/${roleId}/permissions`, permissionIds);
  }
}
