import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface FirstAdminDialogData { companyId: number; companyName: string; }
export interface FirstAdminCreated { id: number; personalInventoryId: number; }

@Component({
  selector: 'app-first-admin-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './first-admin-dialog.html',
  styleUrl: './first-admin-dialog.scss'
})
export class FirstAdminDialogComponent {
  readonly data = inject<FirstAdminDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<FirstAdminDialogComponent>);
  private readonly http = inject(HttpClient);

  firstName = '';
  lastName = '';
  username = '';
  email = '';
  dni = '';
  initialPassword = '';
  confirmPassword = '';
  saving = false;
  error = '';

  get valid(): boolean {
    return !!this.firstName.trim() && !!this.lastName.trim() &&
      this.username.trim().length >= 3 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()) &&
      (!this.dni.trim() || /^\d{8}$/.test(this.dni.trim())) &&
      this.initialPassword.length >= 12 &&
      this.initialPassword === this.confirmPassword;
  }

  close(): void { if (!this.saving) this.ref.close(null); }

  save(): void {
    if (this.saving || !this.valid) return;
    this.saving = true;
    this.error = '';
    const payload = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      username: this.username.trim(),
      email: this.email.trim(),
      dni: this.dni.trim() || null,
      initialPassword: this.initialPassword,
      roleId: 2
    };
    this.http.post<FirstAdminCreated>(
      `https://localhost:7295/api/dev/companies/${this.data.companyId}/first-admin`,
      payload
    ).subscribe({
      next: result => {
        this.initialPassword = '';
        this.confirmPassword = '';
        this.saving = false;
        this.ref.close(result);
      },
      error: err => {
        this.saving = false;
        this.error = String(err?.error?.error || 'No se pudo registrar el administrador.');
      }
    });
  }
}
