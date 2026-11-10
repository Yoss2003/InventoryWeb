import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CompanySelectorComponent } from '../../../shared/company-selector/company-selector';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyPublicService } from '../../../core/services/companies';
import { CompanyThemeService } from '../../../shared/ui/v3/company-theme.service';
import { CompanyPublic } from '../../../core/models/company-public.model';
import { LoginRequest } from '../../../core/models/auth.model';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, CompanySelectorComponent, LoadingIndicatorComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly companiesService = inject(CompanyPublicService);
  private readonly companyTheme = inject(CompanyThemeService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly loginForm: FormGroup = this.fb.group({
    companyId: [null, Validators.required],
    username: ['', [Validators.required, Validators.maxLength(150)]],
    password: ['', Validators.required],
    twoFactorCode: ['']
  });

  companies: CompanyPublic[] = [];
  loadingCompanies = false;
  submitting = false;
  companiesError = '';
  loginError = '';
  requiresTwoFactor = false;
  showPassword = false;
  logoFailed = false;

  ngOnInit(): void { this.companyTheme.reset(); this.loadCompanies(); }

  get selectedCompany(): CompanyPublic | null {
    const id = Number(this.loginForm.get('companyId')?.value);
    return this.companies.find(company => Number(company.id) === id) ?? null;
  }

  get selectedCompanyLogo(): string | null {
    return this.logoFailed ? null : this.companiesService.publicLogoUrl(this.selectedCompany?.logoUrl);
  }

  get selectedCompanyAccent(): string {
    const value = this.selectedCompany?.primaryColorHex?.trim() ?? '';
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#a2d149';
  }

  get selectedCompanyInitials(): string {
    const words = (this.selectedCompany?.businessName || 'Empresa').trim().split(/\s+/);
    return words.slice(0, 2).map(word => word[0]?.toUpperCase() || '').join('');
  }

  loadCompanies(): void {
    if (this.loadingCompanies || this.submitting) return;
    this.loadingCompanies = true;
    this.companiesError = '';
    this.loginError = '';
    this.cdr.markForCheck();
    this.companiesService.getActiveCompanies().subscribe({
      next: companies => {
        this.companies = companies;
        // Si el usuario acaba de refrescar, priorizar su selección actual si sigue activa.
        const selectedId = Number(this.loginForm.get('companyId')?.value);
        const previous = companies.find(company => company.id === selectedId);
        const last = this.authService.getLastSelectedCompanyId();
        const remembered = companies.find(company => company.id === last);
        const initialId = previous?.id ?? remembered?.id ?? (companies.length === 1 ? companies[0].id : null);
        this.loginForm.patchValue({ companyId: initialId });
        this.onCompanyChange();
        this.loadingCompanies = false;
        if (!companies.length) this.companiesError = 'No hay empresas activas disponibles para iniciar sesión.';
        this.cdr.markForCheck();
      },
      error: () => {
        this.companies = [];
        this.loginForm.patchValue({ companyId: null });
        this.loadingCompanies = false;
        this.companiesError = 'No se pudieron cargar las empresas. Comprueba la conexión con la API y vuelve a intentar.';
        this.cdr.markForCheck();
      }
    });
  }

  onCompanyChange(): void {
    this.companyTheme.apply(this.selectedCompany?.primaryColorHex);
    this.logoFailed = false;
    this.loginError = '';
    this.requiresTwoFactor = false;
    this.loginForm.get('twoFactorCode')?.setValue('');
    this.loginForm.get('twoFactorCode')?.clearValidators();
    this.loginForm.get('twoFactorCode')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.submitting || this.loadingCompanies) return;
    this.loginError = '';
    const id = Number(this.loginForm.get('companyId')?.value);
    if (this.loginForm.invalid || !this.companies.some(c => c.id === id)) {
      this.loginForm.markAllAsTouched();
      this.loginError = 'Selecciona una empresa activa y completa los campos obligatorios.';
      return;
    }

    const raw = this.loginForm.getRawValue();
    const payload: LoginRequest = {
      username: String(raw.username).trim(),
      password: String(raw.password),
      companyId: id,
      twoFactorCode: this.requiresTwoFactor ? String(raw.twoFactorCode).trim() : undefined
    };
    if (!payload.username) {
      this.loginError = 'Ingresa un nombre de usuario válido.';
      return;
    }

    this.submitting = true;
    this.cdr.markForCheck();
    this.authService.login(payload).subscribe({
      next: result => {
        if ('requirePasswordChange' in result && result.requirePasswordChange) {
          this.submitting = false;
          // El endpoint actual de cambio inicial no autentica por token; no invocarlo desde aquí.
          this.loginError = 'Tu cuenta necesita cambiar su contraseña inicial. Solicita la actualización al administrador antes de ingresar desde la web.';
          this.cdr.markForCheck();
          return;
        }
        if ('token' in result && result.token) {
          // Mantener el botón bloqueado mientras Angular cambia de página.
          void this.router.navigate(['/dashboard/articulos']).then(navigated => {
            if (!navigated) {
              this.submitting = false;
              this.loginError = 'No fue posible abrir el panel. Vuelve a intentar.';
              this.cdr.markForCheck();
            }
          }).catch(() => {
            this.submitting = false;
            this.loginError = 'No fue posible abrir el panel. Vuelve a intentar.';
            this.cdr.markForCheck();
          });
          this.cdr.markForCheck();
          return;
        }
        this.submitting = false;
        this.loginError = 'No se recibió una sesión válida del servidor.';
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse | Error) => {
        this.submitting = false;
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401 && error.error?.requires2FA) {
            this.requiresTwoFactor = true;
            const control = this.loginForm.get('twoFactorCode');
            control?.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
            control?.updateValueAndValidity();
            this.loginError = 'Introduce el código de 6 dígitos de tu autenticador.';
            this.cdr.markForCheck();
            return;
          }
          if (error.error?.accountPending) {
            this.loginError = 'La cuenta está inactiva o pendiente de aprobación.';
            this.cdr.markForCheck();
            return;
          }
          this.loginError = error.status === 0
            ? 'No hay conexión con la API. Revisa que esté encendida y disponible.'
            : 'No fue posible iniciar sesión. Comprueba la empresa y tus credenciales.';
        } else {
          this.loginError = error.message || 'No se pudo iniciar sesión.';
        }
        this.cdr.markForCheck();
        this.snackBar.open(this.loginError, 'Cerrar', { duration: 4500 });
      }
    });
  }
}
