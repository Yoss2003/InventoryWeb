import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { DevConfirmDialogComponent, DevConfirmDialogData } from '../../shared/confirm-dialog/dev-confirm-dialog';
import { Observable } from 'rxjs';
import {
  DevManagementService, DevCompany, CompanyEdit, ResetPending, LicensePlan, RucLookupResult
} from '../../core/services/dev-management';
import { CompanyPublicService } from '../../core/services/companies';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';
import { ToastService } from '../../shared/toast/toast.service';

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
  private readonly toasts = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly plans: LicensePlan[] = ['Básico', 'Pro', 'Plus', 'Max'];
  readonly developer = this.isDeveloper();
  readonly developerCompanyId = this.getDeveloperCompanyId();
  readonly trackCompany = (_index: number, row: DevCompany): number => row.id;
  readonly trackPending = (_index: number, row: ResetPending): number => row.id;

  companies: DevCompany[] = [];
  private readonly unavailableLogos = new Set<string>();
  pending: ResetPending[] = [];
  selectedId: number | null = null;
  loadingCompanies = false;
  loadingPending = false;
  companiesError = '';
  pendingError = '';
  saving = false;
  renewing = false;
  workingRequestId: number | null = null;
  logoFailed = false;
  lookingUpRuc = false;
  rucResult: RucLookupResult | null = null;
  rucLookupError = '';
  get rucNeedsConfiguration(): boolean { return this.rucLookupError.toLocaleLowerCase('es').includes('token decolecta'); }
  logoFile: File | null = null;
  logoInputError = '';
  private temporaryLogoUrl: string | null = null;
  private lookupGeneration = 0;
  renewPlan: LicensePlan = 'Básico';
  companySearch = '';
  readonly presetColors = ['#A2D149','#FFFFFF','#1F2937','#0EA5E9','#2563EB','#14B8A6','#16A34A','#EAB308','#F97316','#EF4444','#EC4899','#8B5CF6'];
  workingRecoveryId: number | null = null;
  form: CompanyEdit = this.empty();
  private remainingDaysById = new Map<number, number | null>();

  get loading(): boolean { return this.loadingCompanies || this.loadingPending; }
  get filteredCompanies(): DevCompany[] {
    const q = this.companySearch.trim().toLocaleLowerCase('es');
    if (!q) return this.companies;
    return this.companies.filter(x => [x.businessName, x.ruc, x.contactEmail ?? '', x.license?.plan ?? '']
      .some(v => v.toLocaleLowerCase('es').includes(q)));
  }
  planLimit(plan: string | null | undefined): number {
    return plan === 'Básico' || plan === 'Basico' ? 5 : plan === 'Pro' ? 10 : plan === 'Plus' ? 15 : plan === 'Max' ? 0 : -1;
  }
  displayLimit(plan: string | null | undefined, value: number | null | undefined): string {
    if (plan === 'Max' && value === 0) return 'Ilimitados';
    return value === null || value === undefined ? '—' : String(value);
  }
  get displayedLimit(): string { return this.displayLimit(this.form.plan, this.form.maxUsers); }
  onPlanChanged(): void { this.form.maxUsers = this.planLimit(this.form.plan); this.cdr.markForCheck(); }
  chooseColor(color: string): void { if (!this.saving && !this.renewing) {this.form.primaryColorHex = color;this.cdr.markForCheck();} }
  openColorPalette(picker: HTMLInputElement): void {
    if (this.saving || this.renewing) return;
    try { picker.showPicker(); } catch { picker.focus(); }
    this.cdr.markForCheck();
  }
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
  /** La API devuelve una ruta pública del logo; si falla, solo esa fila muestra el ícono genérico. */
  getCompanyLogoUrl(row: DevCompany): string | null {
    const resolved = this.publicCompanies.publicLogoUrl(row.logoUrl);
    return resolved && !this.unavailableLogos.has(resolved) ? resolved : null;
  }

  onCompanyLogoError(row: DevCompany): void {
    const resolved = this.publicCompanies.publicLogoUrl(row.logoUrl);
    if (resolved) this.unavailableLogos.add(resolved);
    this.cdr.markForCheck();
  }

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
      this.toasts.warning(this.rucLookupError, 'RUC inválido');
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
        if (this.rucNeedsConfiguration) this.toasts.warning(this.rucLookupError, 'Consulta RUC no configurada');
        else this.toasts.error(this.rucLookupError, 'Error al consultar RUC');
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
      this.toasts.warning(this.logoInputError, 'Archivo no admitido');
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
      plan: 'Básico', maxUsers: 5, licenseEnabled: true,
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
    return value === 'Básico' || value === 'Pro' || value === 'Plus' || value === 'Max';
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
        this.toasts.error(this.companiesError, 'Error al cargar empresas');
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
        this.toasts.error(this.pendingError, 'Error al cargar recuperaciones');
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
      plan: row.license?.plan ?? 'Básico',
      maxUsers: row.license?.maxUsers ?? 5,
      licenseEnabled: row.license?.isEnabled ?? true,
      primaryColorHex: row.primaryColorHex || '#A2D149',
      logoUrl: row.logoUrl
    };
    const currentPlan = row.license?.plan;
    this.renewPlan = this.isKnownPlan(currentPlan) ? currentPlan : 'Básico';
    this.logoFailed = false;
    this.cdr.markForCheck();
  }

  newCompany(): void {
    if (this.saving || this.renewing) return;
    this.clearPendingLogo();
    this.onRucChanged();
    this.selectedId = null;
    this.form = this.empty();
    this.renewPlan = 'Básico';
    this.logoFailed = false;
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
    if (!Number.isInteger(maxUsers) || maxUsers < 0) return 'El cupo de la licencia no es válido.';
    if (!this.editing && maxUsers !== this.planLimit(this.form.plan)) return 'El cupo no corresponde al plan seleccionado.';
    if (!this.editing && !this.isKnownPlan(this.form.plan)) return 'Selecciona una licencia Básico, Pro, Plus o Max.';
    // No modificar el plan existente desde Guardar; se cambia solo mediante Renovar.
    if (this.editing && this.selectedCompany?.license && this.form.plan !== this.selectedCompany.license.plan)
      return 'El plan existente solo puede cambiarse mediante la renovación.';
    return null;
  }

  save(): void {
    if (this.saving || this.renewing) return;
    const validation = this.validate();
    if (validation) { this.toasts.warning(validation, 'Revisa el formulario'); this.cdr.markForCheck(); return; }

    const body: CompanyEdit = {
      ...this.form,
      businessName: this.form.businessName.trim(),
      ruc: this.form.ruc.trim(),
      fiscalOwnerName: String(this.form.fiscalOwnerName ?? '').trim() || null,
      contactEmail: String(this.form.contactEmail ?? '').trim() || null,
      primaryColorHex: String(this.form.primaryColorHex ?? '').trim() || null,
      logoUrl: this.form.logoUrl?.trim() || null,
      maxUsers: this.editing ? Number(this.form.maxUsers) : this.planLimit(this.form.plan)
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
          this.toasts.error('La API no devolvió el identificador de la empresa creada.', 'Error de respuesta');
          this.loadCompanies();
          this.cdr.markForCheck();
          return;
        }
        if (!selectedImage) {
          this.finishSave(wasEditing, false);
          return;
        }
        this.api.uploadLogo(savedId, selectedImage).subscribe({
          next: uploaded => {
            if (!uploaded?.logoUrl) {
              this.selectedId = savedId;
              this.saving = false;
              this.toasts.warning('La empresa se guardó, pero no se recibió la dirección del logo. Revisa el registro en CompanyLogos.', 'Verificar logo');
              this.loadCompanies();
              this.cdr.markForCheck();
              return;
            }
            this.form.logoUrl = uploaded.logoUrl;
            this.unavailableLogos.delete(this.publicCompanies.publicLogoUrl(uploaded.logoUrl) ?? '');
            this.finishSave(wasEditing, true);
          },
          error: e => {
            // La empresa ya se guardó. Conservar su ID para reintentar el logo sin crear un duplicado.
            this.selectedId = savedId;
            this.saving = false;
            this.toasts.warning('La empresa se guardó, pero el logo no pudo subirse: ' +
              this.errorFromApi(e, 'inténtalo de nuevo desde Editar.'), 'Guardado parcial');
            this.loadCompanies();
            this.cdr.markForCheck();
          }
        });
      },
      error: e => {
        this.saving = false;
        this.toasts.error(this.errorFromApi(e, 'No se pudo guardar la empresa.'), 'No se pudo guardar');
        this.cdr.markForCheck();
      }
    });
  }

  private finishSave(wasEditing: boolean, logoUploaded: boolean): void {
    this.saving = false;
    this.newCompany();
    this.toasts.success(wasEditing
      ? (logoUploaded ? 'Empresa y logo actualizados sin renovar la licencia.' : 'Datos de empresa actualizados sin renovar la licencia.')
      : (logoUploaded ? 'Empresa, licencia y logo guardados correctamente.' : 'Empresa y licencia creadas correctamente.'));
    this.loadCompanies();
    this.cdr.markForCheck();
  }

  /** Confirmación coherente con el tema oscuro, con soporte de Escape y foco del teclado. */
  private askConfirmation(data: DevConfirmDialogData, onConfirm: () => void): void {
    this.dialog.open(DevConfirmDialogComponent, {
      width: 'min(440px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      data
    }).afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) onConfirm();
    });
  }

  renewLicense(): void {
    const row = this.selectedCompany;
    if (!row || !row.isActive || this.isSelectedProtected || this.saving || this.renewing) return;
    if (!this.isKnownPlan(this.renewPlan)) { this.toasts.warning('Selecciona un plan válido.'); return; }
    const maxUsers = this.planLimit(this.renewPlan);
    if (maxUsers < 0 || (maxUsers > 0 && maxUsers < row.userCount)) {
      this.toasts.warning('El plan seleccionado admite menos usuarios que los que están activos.');
      return;
    }
    const selectedPlan = this.renewPlan;
    const duration = this.renewDurationLabel;
    this.askConfirmation({
      title: 'Renovar licencia',
      message: `¿Renovar la licencia de «${row.businessName}» al plan ${selectedPlan}? Se añadirán ${duration} a su vigencia, según las reglas del servidor.`,
      confirmLabel: 'Renovar licencia',
      tone: 'primary',
      icon: 'event_repeat'
    }, () => {
      if (this.saving || this.renewing || this.workingRequestId !== null) return;
      this.renewing = true;
      this.cdr.markForCheck();
      this.api.renewLicense(row.id, { plan: selectedPlan, maxUsers }).subscribe({
        next: license => {
          this.renewing = false;
          this.form.plan = license.plan;
          this.form.maxUsers = license.maxUsers;
          this.form.licenseEnabled = license.isEnabled;
          this.companies = this.companies.map(c => c.id === row.id ? { ...c, license } : c);
          this.updateDaysRemaining(this.companies);
          this.toasts.success('Licencia renovada. La fecha mostrada proviene del servidor.');
          this.loadCompanies();
          this.cdr.markForCheck();
        },
        error: e => {
          this.renewing = false;
          this.toasts.error(this.errorFromApi(e, 'No se pudo renovar la licencia.'), 'Error al renovar');
          this.cdr.markForCheck();
        }
      });
    });
  }

  deactivate(row: DevCompany): void {
    if (this.isProtectedCompany(row) || this.workingRequestId !== null || !row.isActive) return;
    this.askConfirmation({
      title: 'Desactivar empresa',
      message: `¿Deseas desactivar «${row.businessName}»? Esta acción solo se permite si la empresa no tiene usuarios, inventarios ni otras operaciones asociadas. No se eliminarán registros.`,
      confirmLabel: 'Sí, desactivar',
      tone: 'danger',
      icon: 'block'
    }, () => {
      if (this.isProtectedCompany(row) || this.workingRequestId !== null) return;
      this.workingRequestId = row.id;
      this.cdr.markForCheck();
      this.api.deactivate(row.id).subscribe({
        next: () => {
          this.workingRequestId = null;
          this.toasts.success(`Empresa «${row.businessName}» desactivada.`);
          this.loadCompanies();
          this.cdr.markForCheck();
        },
        error: e => {
          this.workingRequestId = null;
          this.toasts.error(this.errorFromApi(e, 'No se pudo desactivar la empresa.'), 'Error al desactivar');
          this.cdr.markForCheck();
        }
      });
    });
  }

  /** Reactiva solo el estado de la empresa; la licencia existente no se renueva. */
  reactivate(row: DevCompany): void {
    if (this.isProtectedCompany(row) || this.workingRequestId !== null || row.isActive ||
        this.saving || this.renewing) return;
    this.askConfirmation({
      title: 'Reactivar empresa',
      message: `¿Deseas reactivar «${row.businessName}»? Se conservarán sus datos, usuarios, inventarios y la licencia actual. Si la licencia está suspendida o vencida, el acceso seguirá bloqueado hasta regularizarla.`,
      confirmLabel: 'Sí, reactivar',
      tone: 'primary',
      icon: 'check_circle'
    }, () => {
      if (this.isProtectedCompany(row) || this.workingRequestId !== null ||
          row.isActive || this.saving || this.renewing) return;
      this.workingRequestId = row.id;
      this.cdr.markForCheck();
      this.api.reactivate(row.id).subscribe({
        next: () => {
          this.workingRequestId = null;
          this.companies = this.companies.map(c => c.id === row.id ? { ...c, isActive: true } : c);
          this.toasts.success(`Empresa «${row.businessName}» reactivada.`);
          const license = row.license;
          if (!license || !license.isEnabled ||
              !Number.isFinite(Date.parse(license.expiresAt)) ||
              Date.parse(license.expiresAt) <= Date.now()) {
            this.toasts.warning('La licencia sigue ausente, suspendida o vencida. Reactivar la empresa no renueva el acceso.', 'Revisar licencia');
          }
          this.loadCompanies();
          this.cdr.markForCheck();
        },
        error: e => {
          this.workingRequestId = null;
          this.toasts.error(this.errorFromApi(e, 'No se pudo reactivar la empresa.'), 'Error al reactivar');
          this.cdr.markForCheck();
        }
      });
    });
  }

  review(req: ResetPending, approve: boolean): void {
    if (this.workingRecoveryId !== null) return;
    this.askConfirmation({
      title: approve ? 'Aprobar recuperación' : 'Rechazar recuperación',
      message: `¿${approve ? 'Aprobar' : 'Rechazar'} la recuperación del usuario «${req.username}» en «${req.company}»?`,
      confirmLabel: approve ? 'Sí, aprobar' : 'Sí, rechazar',
      tone: approve ? 'primary' : 'danger',
      icon: approve ? 'verified_user' : 'person_off'
    }, () => {
      if (this.workingRecoveryId !== null) return;
      const call: Observable<unknown> = approve ? this.api.approve(req.id) : this.api.reject(req.id);
      this.workingRecoveryId = req.id;
      this.cdr.markForCheck();
      call.subscribe({
        next: () => {
          this.workingRecoveryId = null;
          this.toasts.success(approve ? 'Solicitud aprobada y correo enviado.' : 'Solicitud rechazada.');
          this.loadPending();
          this.cdr.markForCheck();
        },
        error: e => {
          this.workingRecoveryId = null;
          this.toasts.error(this.errorFromApi(e, 'No se pudo procesar la solicitud.'), 'Error de recuperación');
          this.cdr.markForCheck();
        }
      });
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
