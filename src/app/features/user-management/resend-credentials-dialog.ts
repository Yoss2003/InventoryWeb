import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ManagedUser, UserManagementService } from '../../core/services/user-management';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-resend-credentials-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './resend-credentials-dialog.html',
  styleUrl: './resend-credentials-dialog.scss'
})
export class ResendCredentialsDialogComponent {
  readonly data = inject<ManagedUser>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ResendCredentialsDialogComponent, boolean>);
  private readonly users = inject(UserManagementService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  email = this.data.email || '';
  sending = false;
  get valid(): boolean {
    return !this.sending && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }
  close(): void { if (!this.sending) this.ref.close(false); }
  send(): void {
    if (!this.valid) return;
    this.sending = true;
    this.users.resendCredentials(this.data.id, this.email.trim()).subscribe({
      next: res => {
        this.sending = false;
        if (res.emailSent) {
          this.ref.close(true);
        } else {
          // El alta y el correo corregido pueden haberse guardado aun si SMTP falló.
          // Mantener el modal abierto para reintentar y mostrar el aviso como toast.
          this.toast.warning(res.message ||
            'No se confirmó el envío del correo. Revisa SMTP y vuelve a intentar.',
            'No se pudo enviar el correo');
        }
        this.cdr.markForCheck();
      },
      error: e => {
        this.sending = false;
        this.toast.error(String(e?.error?.error || e?.error?.message ||
          'No se pudo emitir una contraseña nueva.'), 'Error al reenviar credenciales');
        this.cdr.markForCheck();
      }
    });
  }
}
