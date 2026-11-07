import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import {
  DevManagementService, DevCompany, CompanyEdit, ResetPending, LicensePlan, RucLookupResult
} from '../../core/services/dev-management';
import { CompanyPublicService } from '../../core/services/companies';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';

@Component({
  selector: 'app-dev-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatIconModule, LoadingIndicatorComponent],
  templateUrl: './dev-management.html',
  styleUrl: './dev-management.scss'
})
export class DevManagementComponent implements OnInit, OnDestroy {
  private readonly api = inject(DevManagementService);
  private readonly publicCompanies = inject(CompanyPublicService);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly plans: LicensePlan[] = ['Pro', 'Plus', 'Max'];
  readonly developer = this.isDeveloper();
  readonly developerCompanyId = this.getDeveloperCompanyId();
  readonly trackCompany = (_index: number, row: DevCompany): number => row.id;
  readonly trackPending = (_index: number, row: ResetPending): number => row.id;

  companies: DevCompany[] = [];
  pending: ResetPending[] = [];
  selectedId: number | null = null;
  loadingCompanies = false;
  loadingPending = false;
  companiesError = '';
  pendingError = '';
  error = '';
  notice = '';
  saving = false;
  renewing = false;
  workingRequestId: number | null = null;
  logoFailed = false;
  lookingUpRuc = false;
  rucResult: RucLookupResult | null = null;
  rucLookupError = '';
  logoFile: File | null = null;
  logoInputError = '';
  private temporaryLogoUrl: string | null = null;
  private lookupGeneration = 0;
  renewPlan: LicensePlan = 'Pro';
  form: CompanyEdit = this.empty();
  private remainingDaysById = new Map<number, number | null>();

  get loading(): boolean { return this.loadingCompanies || this.loadingPending; }
  get editing(): boolean { return this.selectedId !== null; }
  get selectedCompany(): DevCompany | null {
    return this.companies.find(c => c.id === this.selectedId) ?? null;
  }
  get isSelectedProtected(): boolean {
    return this.selectedId !== null && this.selectedId === this.developerCompanyId;
  }
  get currentUserCount(): number { return this.selectedCompany?.userCount ?? 0; }
  get durationLabel(): string { return this.form.plan === 'Max' ? '3 meses' : '1 mes'; }
  get renewDurationLabel(): string { return this.renewPlan === 'Max' ? '3 meses' : '1 mes'; }
  get logoPreview(): string | null {
    return this.logoFailed ? null : (this.temporaryLogoUrl ?? this.publicCompanies.publicLogoUrl(this.form.logoUrl));
  }

  ngOnDestroy(): void { this.clearPendingLogo(); }

  private clearPendingLogo(): void {
    if (this.temporaryLogoUrl && isPlatformBrowser(this.platform)) URL.revokeObjectURL(this.temporaryLogoUrl);
    this.temporaryLogoUrl = null;
    this.logoFile = null;
    this.logoInputError = '';
  }

  onRucChanged(): void {
    this.lookupGeneration++;
    this.rucResult = null;
    this.rucLookupError = '';
    this.lookingUpRuc = false;
  }

  lookupRuc(): void {
    const ruc = this.form.ruc.trim();
    this.rucLookupError = '';
    if (!/^\d{11}$/.test(ruc)) {
      this.rucLookupError = 'Ingresa un RUC de exactamente 11 dígitos.';
      return;
    }
    if (this.lookingUpRuc || this.saving) return;
    this.lookingUpRuc = true;
    const requestGeneration = ++this.lookupGeneration;
    this.cdr.markForCheck();
    this.api.lookupRuc(ruc).subscribe({
      next: response => {
        if (requestGeneration !== this.lookupGeneration || this.form.ruc.trim() !== ruc) return;
        this.lookingUpRuc = false;
        this.rucResult = response;
        this.form.businessName = response.businessName;
        this.cdr.markForCheck();
      },
      error: e => {
        if (requestGeneration !== this.lookupGeneration) return;
        this.lookingUpRuc = false;
        this.rucLookupError = this.errorFromApi(e, 'No se pudo consultar el RUC. Puedes completar los datos manualmente.');
        this.cdr.markForCheck();
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearPendingLogo();
    this.logoFailed = false;
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type) || file.size <= 0 || file.size > 2 * 1024 * 1024) {
      this.logoInputError = 'Usa PNG, JPG o WebP de hasta 2 MB.';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }
    this.logoFile = file;
    input.value = ''; // Permite volver a seleccionar el mismo archivo sin recargar el formulario.
    if (isPlatformBrowser(this.platform)) this.temporaryLogoUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    if (!this.developer) {
      void this.router.navigate(['/dashboard/articulos']);
      return;
    }
    this.reload();
  }

  private getSession(): { roleId?: number; companyId?: number } {
    if (!isPlatformBrowser(this.platform)) return {};
    try { return JSON.parse(localStorage.getItem('userSession') || '{}'); }
    catch { return {}; }
  }
  private isDeveloper(): boolean { return Number(this.getSession().roleId) === 1; }
  private getDeveloperCompanyId(): number | null {
    const id = Number(this.getSession().companyId);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private empty(): CompanyEdit {
    return {
      businessName: '', ruc: '', fiscalOwnerName: '', contactEmail: '',
      plan: 'Pro', maxUsers: 5, licenseEnabled: true,
      primaryColorHex: '#A2D149', logoUrl: null
    };
  }

  daysRemaining(item: DevCompany): number | null {
    return this.remainingDaysById.get(item.id) ?? null;
  }
  private updateDaysRemaining(rows: DevCompany[]): void {
    const now = Date.now();
    const days = new Map<number, number | null>();
    for (const item of rows) {
      const time = item.license?.expiresAt ? Date.parse(item.license.expiresAt) : NaN;
      days.set(item.id, Number.isFinite(time) ? Math.ceil((time - now) / 86400000) : null);
    }
    this.remainingDaysById = days;
  }

  isKnownPlan(value: string | null | undefined): value is LicensePlan {
    return value === 'Pro' || value === 'Plus' || value === 'Max';
  }
  isProtectedCompany(row: DevCompany): boolean {
    // Refuerzo visual. La API es la que realmente bloquea operaciones sobre empresas con desarrolladores.
    return row.id === this.developerCompanyId;
  }

  reload(): void { this.loadCompanies(); this.loadPending(); }
  loadCompanies(): void {
    if (this.loadingCompanies) return;
    this.loadingCompanies = true;
    this.companiesError = '';
    this.cdr.markForCheck();
    this.api.list().subscribe({
      next: rows => {
        this.companies = rows;
        this.updateDaysRemaining(rows);
        this.loadingCompanies = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingCompanies = false;
        this.companiesError = 'No se pudieron actualizar las empresas. Los datos visibles pueden estar desactualizados.';
        this.cdr.markForCheck();
      }
    });
  }
  loadPending(): void {
    if (this.loadingPending) return;
    this.loadingPending = true;
    this.pendingError = '';
    this.cdr.markForCheck();
    this.api.pending().subscribe({
      next: rows => { this.pending = rows; this.loadingPending = false; this.cdr.markForCheck(); },
      error: () => {
        this.loadingPending = false;
        this.pendingError = 'No se pudieron actualizar las recuperaciones. Los datos visibles pueden estar desactualizados.';
        this.cdr.markForCheck();
      }
    });
  }

  select(row: DevCompany): void {
    if (this.saving || this.renewing) return;
    this.clearPendingLogo();
    this.onRucChanged();
    this.selectedId = row.id;
    this.form = {
      businessName: row.businessName,
      ruc: row.ruc,
      fiscalOwnerName: row.fiscalOwnerName ?? '',
      contactEmail: row.contactEmail ?? '',
      plan: row.license?.plan ?? 'Pro',
      maxUsers: row.license?.maxUsers ?? Math.max(row.userCount, 5),
      licenseEnabled: row.license?.isEnabled ?? true,
      primaryColorHex: row.primaryColorHex || '#A2D149',
      logoUrl: row.logoUrl
    };
    const currentPlan = row.license?.plan;
    this.renewPlan = this.isKnownPlan(currentPlan) ? currentPlan : 'Pro';
    this.logoFailed = false;
    this.error = '';
    this.notice = '';
    this.cdr.markForCheck();
  }

  newCompany(): void {
    if (this.saving || this.renewing) return;
    this.clearPendingLogo();
    this.onRucChanged();
    this.selectedId = null;
    this.form = this.empty();
    this.renewPlan = 'Pro';
    this.logoFailed = false;
    this.error = '';
    this.notice = '';
    this.cdr.markForCheck();
  }

  private validate(): string | null {
    const name = this.form.businessName.trim();
    const owner = String(this.form.fiscalOwnerName ?? '').trim();
    const email = String(this.form.contactEmail ?? '').trim();
    const ruc = this.form.ruc.trim();
    const color = String(this.form.primaryColorHex ?? '').trim();
    const maxUsers = Number(this.form.maxUsers);
    if (!name || name.length > 255) return 'La razón social es obligatoria (máximo 255 caracteres).';
    if (!/^\d{11}$/.test(ruc)) return 'El RUC debe contener exactamente 11 dígitos.';
    if (!this.editing || owner) {
      if (!owner || owner.length > 255) return 'Ingresa el dueño fiscal (máximo 255 caracteres).';
    }
    if (!this.editing || email) {
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return 'Ingresa un correo empresarial válido.';
    }
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) return 'El color debe tener el formato #RRGGBB.';
    if (!Number.isInteger(maxUsers) || maxUsers < 1) return 'El cupo permitido debe ser un entero mayor que cero.';
    if (this.editing && !this.isSelectedProtected && maxUsers < this.currentUserCount)
      return 'El cupo no puede ser menor que la cantidad actual de usuarios activos.';
    if (!this.editing && !this.isKnownPlan(this.form.plan)) return 'Selecciona una licencia Pro, Plus o Max.';
    // No modificar el plan existente desde Guardar; se cambia solo mediante Renovar.
    if (this.editing && this.selectedCompany?.license && this.form.plan !== this.selectedCompany.license.plan)
      return 'El plan existente solo puede cambiarse mediante la renovación.';
    return null;
  }

  save(): void {
    if (this.saving || this.renewing) return;
    this.error = '';
    this.notice = '';
    const validation = this.validate();
    if (validation) { this.error = validation; this.cdr.markForCheck(); return; }

    const body: CompanyEdit = {
      ...this.form,
      businessName: this.form.businessName.trim(),
      ruc: this.form.ruc.trim(),
      fiscalOwnerName: String(this.form.fiscalOwnerName ?? '').trim() || null,
      contactEmail: String(this.form.contactEmail ?? '').trim() || null,
      primaryColorHex: String(this.form.primaryColorHex ?? '').trim() || null,
      logoUrl: this.form.logoUrl?.trim() || null,
      maxUsers: Number(this.form.maxUsers)
    };
    // La API exige dueño fiscal/correo al crear; en ediciones históricas permite null.
    const wasEditing = this.editing;
    const originalId = this.selectedId;
    const call: Observable<unknown> = originalId === null
      ? this.api.create(body)
      : this.api.update(originalId, body);
    const selectedImage = this.logoFile;
    this.saving = true;
    this.cdr.markForCheck();
    call.subscribe({
      next: result => {
        const responseId = result && typeof result === 'object' && 'id' in result ? Number(result.id) : null;
        const savedId = originalId ?? responseId;
        if (!savedId) {
          this.saving = false;
          this.error = 'La API no devolvió el identificador de la empresa creada.';
          this.loadCompanies();
          this.cdr.markForCheck();
          return;
        }
        if (!selectedImage) {
          this.finishSave(wasEditing);
          return;
        }
        this.api.uploadLogo(savedId, selectedImage).subscribe({
          next: uploaded => {
            this.form.logoUrl = uploaded.logoUrl;
            this.finishSave(wasEditing);
          },
          error: e => {
            // La empresa ya se guardó. Conservar su ID para reintentar el logo sin crear un duplicado.
            this.selectedId = savedId;
            this.saving = false;
            this.error = 'Los datos de la empresa se guardaron, pero el logo no pudo subirse: ' +
              this.errorFromApi(e, 'inténtalo de nuevo desde Editar.');
            this.loadCompanies();
            this.cdr.markForCheck();
          }
        });
      },
      error: e => {
        this.saving = false;
        this.error = this.errorFromApi(e, 'No se pudo guardar la empresa.');
        this.cdr.markForCheck();
      }
    });
  }

  private finishSave(wasEditing: boolean): void {
    this.saving = false;
    this.newCompany();
    this.notice = wasEditing
      ? 'Datos y logo de empresa actualizados sin renovar la licencia.'
      : 'Empresa y licencia creadas correctamente.';
    this.loadCompanies();
    this.cdr.markForCheck();
  }

  renewLicense(): void {
    const row = this.selectedCompany;
    if (!row || !row.isActive || this.isSelectedProtected || this.saving || this.renewing) return;
    this.error = '';
    this.notice = '';
    if (!this.isKnownPlan(this.renewPlan)) { this.error = 'Selecciona un plan válido.'; return; }
    const maxUsers = Number(this.form.maxUsers);
    if (!Number.isInteger(maxUsers) || maxUsers < Math.max(1, row.userCount)) {
      this.error = 'El cupo permitido no puede ser menor que los usuarios activos.';
      return;
    }
    if (!confirm(`¿Renovar la licencia de ${row.businessName} al plan ${this.renewPlan}? Se agregarán ${this.renewDurationLabel} a la vigencia según las reglas del servidor.`)) return;
    this.renewing = true;
    this.cdr.markForCheck();
    this.api.renewLicense(row.id, { plan: this.renewPlan, maxUsers }).subscribe({
      next: license => {
        this.renewing = false;
        this.form.plan = license.plan;
        this.form.maxUsers = license.maxUsers;
        this.form.licenseEnabled = license.isEnabled;
        // Actualización optimista segura: los valores provienen de la respuesta de la API.
        this.companies = this.companies.map(c => c.id === row.id ? { ...c, license } : c);
        this.updateDaysRemaining(this.companies);
        this.notice = 'Licencia renovada. La fecha mostrada proviene del servidor.';
        this.loadCompanies();
        this.cdr.markForCheck();
      },
      error: e => {
        this.renewing = false;
        this.error = this.errorFromApi(e, 'No se pudo renovar la licencia.');
        this.cdr.markForCheck();
      }
    });
  }

  deactivate(row: DevCompany): void {
    if (this.isProtectedCompany(row) || this.workingRequestId !== null) return;
    if (!confirm(`¿Desactivar ${row.businessName}? Solo es posible si no tiene registros asociados.`)) return;
    this.workingRequestId = row.id;
    this.cdr.markForCheck();
    this.api.deactivate(row.id).subscribe({
      next: () => {
        this.workingRequestId = null;
        this.notice = 'Empresa desactivada.';
        this.loadCompanies(); this.cdr.markForCheck();
      },
      error: e => {
        this.workingRequestId = null;
        this.error = this.errorFromApi(e, 'No se pudo desactivar la empresa.');
        this.cdr.markForCheck();
      }
    });
  }

  review(req: ResetPending, approve: boolean): void {
    if (!confirm(`${approve ? 'Aprobar' : 'Rechazar'} recuperación de ${req.username} en ${req.company}?`)) return;
    const call: Observable<unknown> = approve ? this.api.approve(req.id) : this.api.reject(req.id);
    call.subscribe({
      next: () => {
        this.notice = approve ? 'Solicitud aprobada y correo enviado.' : 'Solicitud rechazada.';
        this.loadPending(); this.cdr.markForCheck();
      },
      error: e => { this.error = this.errorFromApi(e, 'No se pudo procesar la solicitud.'); this.cdr.markForCheck(); }
    });
  }

  private errorFromApi(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;
    const body = (error as { error?: unknown }).error;
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      const obj = body as { error?: unknown; message?: unknown };
      if (typeof obj.error === 'string') return obj.error;
      if (typeof obj.message === 'string') return obj.message;
    }
    return fallback;
  }
}
