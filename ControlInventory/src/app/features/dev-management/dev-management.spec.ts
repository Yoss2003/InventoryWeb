import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '../../shared/toast/toast.service';
import { of, Subject } from 'rxjs';
import { DevManagementComponent } from './dev-management';
import { DevManagementService, DevCompany, CompanyEdit, ResetPending } from '../../core/services/dev-management';
import { CompanyPublicService } from '../../core/services/companies';

const row: DevCompany = {
  id: 4, businessName: 'Empresa de prueba', ruc: '20123456789', fiscalOwnerName: 'Propietario',
  contactEmail: 'admin@ejemplo.com', isActive: true, logoUrl: null,
  primaryColorHex: '#A2D149', userCount: 2, totalUsers: 3, inventoryCount: 1,
  license: { plan: 'Pro', maxUsers: 5, startsAt: null, expiresAt: '2027-01-01T00:00:00Z', isEnabled: true }
};

describe('Gestión Dev: Fase 2.2', () => {
  it('mantiene empresas si falla la consulta de recuperaciones y reintenta solo esa sección', () => {
    const companies = new Subject<DevCompany[]>();
    const pending = new Subject<ResetPending[]>();
    let companyCalls = 0;
    let pendingCalls = 0;
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: CompanyPublicService, useValue: { publicLogoUrl: () => null } },
      { provide: DevManagementService, useValue: {
        list: () => { companyCalls++; return companies; },
        pending: () => { pendingCalls++; return pending; }
      } }
    ] });
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    page.reload(); page.reload();
    expect(companyCalls).toBe(1);
    expect(pendingCalls).toBe(1);
    companies.next([row]); companies.complete();
    pending.error(new Error('offline'));
    expect(page.companies[0].id).toBe(4);
    expect(page.companiesError).toBe('');
    expect(page.pendingError).toBeTruthy();
    expect(page.loading).toBe(false);
    page.loadPending();
    expect(companyCalls).toBe(1);
    expect(pendingCalls).toBe(2);
  });

  it('crea con dueño, correo y plan Max, sin enviar fecha de vencimiento', () => {
    const capture: { body?: CompanyEdit } = {};
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: CompanyPublicService, useValue: { publicLogoUrl: () => null } },
      { provide: DevManagementService, useValue: {
        create: (body: CompanyEdit) => { capture.body = body; return of({ id: 10 }); },
        list: () => of([row])
      } }
    ] });
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    page.form = {
      businessName: ' Empresa nueva ', ruc: '20612345678', fiscalOwnerName: ' Dueño fiscal ',
      contactEmail: ' contacto@empresa.com ', plan: 'Max', maxUsers: 0,
      licenseEnabled: true, primaryColorHex: '#A2D149', logoUrl: null
    };
    page.save();
    expect(capture.body).toBeTruthy();
    expect(capture.body?.businessName).toBe('Empresa nueva');
    expect(capture.body?.fiscalOwnerName).toBe('Dueño fiscal');
    expect(capture.body?.contactEmail).toBe('contacto@empresa.com');
    expect(capture.body?.plan).toBe('Max');
    expect('expiresAt' in (capture.body as CompanyEdit)).toBe(false);
  });

  it('al editar mantiene el plan anterior y no envía una fecha de renovación', () => {
    const capture: { body?: CompanyEdit } = {};
    const update: { id?: number } = {};
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: CompanyPublicService, useValue: { publicLogoUrl: () => null } },
      { provide: DevManagementService, useValue: {
        update: (id: number, body: CompanyEdit) => { update.id = id; capture.body = body; return of(void 0); },
        list: () => of([row])
      } }
    ] });
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    page.companies = [row];
    page.select(row);
    page.form.businessName = 'Nombre actualizado';
    page.save();
    expect(update.id).toBe(4);
    expect(capture.body?.plan).toBe('Pro');
    expect(capture.body?.businessName).toBe('Nombre actualizado');
    expect('expiresAt' in (capture.body as CompanyEdit)).toBe(false);
  });
});


describe('Gestión Dev: consulta de RUC y selección de logo', () => {
  it('rellena la razón social desde el servicio de consulta de RUC', () => {
    TestBed.configureTestingModule({providers: [provideRouter([]),
      { provide: CompanyPublicService, useValue: {publicLogoUrl: () => null} }, {
      provide: DevManagementService,
      useValue: {
        lookupRuc: () => of({
          ruc: '20123456789', businessName: 'Empresa de Prueba SAC', address: '',
          estado: 'ACTIVO', condicion: 'HABIDO', source: 'Decolecta / SUNAT'
        })
      }
    }]});
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    page.form.ruc = '20123456789';
    page.lookupRuc();
    expect(page.form.businessName).toBe('Empresa de Prueba SAC');
    expect(page.lookingUpRuc).toBe(false);
    expect(page.rucResult?.estado).toBe('ACTIVO');
  });

  it('rechaza archivos que no sean imágenes permitidas', () => {
    TestBed.configureTestingModule({providers: [provideRouter([]),
      { provide: CompanyPublicService, useValue: {publicLogoUrl: () => null} }, {
      provide: DevManagementService, useValue: {}
    }]});
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    const input = {files: [new File(['texto'], 'malicioso.txt', {type:'text/plain'})], value:'malicioso.txt'};
    page.onLogoSelected({target: input} as unknown as Event);
    expect(page.logoFile).toBeNull();
    expect(page.logoInputError).toContain('PNG');
  });
});


describe('Gestión Dev: catálogo fijo de planes', () => {
  it('inicia con Básico, cinco usuarios, y deja los cupos de los planes definidos en la UI', () => {
    TestBed.configureTestingModule({providers: [provideRouter([]),
      { provide: CompanyPublicService, useValue: { publicLogoUrl: () => null } },
      { provide: DevManagementService, useValue: {} }
    ]});
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    expect(page.form.plan).toBe('Básico');
    expect(page.form.maxUsers).toBe(5);
    expect(page.planLimit('Pro')).toBe(10);
    expect(page.planLimit('Plus')).toBe(15);
    expect(page.planLimit('Max')).toBe(0);
    page.form.plan = 'Max'; page.onPlanChanged();
    expect(page.form.maxUsers).toBe(0);
    expect(page.displayedLimit).toBe('Ilimitados');
    page.newCompany();
    expect(page.form.plan).toBe('Básico');
    expect(page.form.maxUsers).toBe(5);
    expect(page.form.ruc).toBe('');
  });
});


describe('Gestión Dev: reactivación segura', () => {
  it('pide confirmación, reactiva una empresa inactiva y no renueva su licencia', () => {
    const inactive: DevCompany = { ...row, isActive: false };
    let reactivatedId: number | null = null;
    let renewCalls = 0;
    let confirmationTitle = '';
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: CompanyPublicService, useValue: { publicLogoUrl: () => null } },
      { provide: MatDialog, useValue: { open: (_component: unknown, options: { data: { title: string } }) => {
        confirmationTitle = options.data.title;
        return { afterClosed: () => of(true) };
      } } },
      { provide: ToastService, useValue: { success: () => {}, warning: () => {}, error: () => {} } },
      { provide: DevManagementService, useValue: {
        reactivate: (id: number) => { reactivatedId = id; return of(void 0); },
        renewLicense: () => { renewCalls++; return of({}); },
        list: () => of([{ ...inactive, isActive: true }])
      } }
    ] });
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    page.companies = [inactive];
    page.reactivate(inactive);
    expect(confirmationTitle).toBe('Reactivar empresa');
    expect(reactivatedId).toBe(inactive.id);
    expect(renewCalls).toBe(0);
    expect(page.companies[0].isActive).toBe(true);
    expect(page.companies[0].license?.expiresAt).toBe(inactive.license?.expiresAt);
    expect(page.workingRequestId).toBeNull();
  });

  it('no solicita reactivación si se cancela la confirmación', () => {
    const inactive: DevCompany = { ...row, isActive: false };
    let calls = 0;
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: CompanyPublicService, useValue: { publicLogoUrl: () => null } },
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      { provide: ToastService, useValue: { success: () => {}, warning: () => {}, error: () => {} } },
      { provide: DevManagementService, useValue: { reactivate: () => { calls++; return of(void 0); } } }
    ] });
    const page = TestBed.createComponent(DevManagementComponent).componentInstance;
    page.companies = [inactive];
    page.reactivate(inactive);
    expect(calls).toBe(0);
    expect(inactive.isActive).toBe(false);
  });
});
