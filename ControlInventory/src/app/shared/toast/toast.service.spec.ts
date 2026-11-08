import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  it('muestra avisos de éxito y error con duraciones diferentes', () => {
    const service = TestBed.inject(ToastService);
    service.success('Empresa registrada');
    service.error('El servidor rechazó el plan');
    expect(service.toasts().length).toBe(2);
    expect(service.toasts()[0].type).toBe('success');
    expect(service.toasts()[1].type).toBe('error');
    expect(service.toasts()[1].durationMs).toBeGreaterThan(service.toasts()[0].durationMs);
    service.toasts().forEach(toast => service.dismiss(toast.id));
  });

  it('mantiene como máximo cuatro notificaciones', () => {
    const service = TestBed.inject(ToastService);
    for (let i = 0; i < 7; i++) service.info('Mensaje ' + i);
    expect(service.toasts().length).toBe(4);
    expect(service.toasts()[0].message).toBe('Mensaje 3');
    service.toasts().forEach(toast => service.dismiss(toast.id));
  });
});
