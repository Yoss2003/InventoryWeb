import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface AppToast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  durationMs: number;
  closing: boolean;
}

/** Notificaciones no persistentes compartidas por todas las rutas de la aplicación. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly current = signal<AppToast[]>([]);
  readonly toasts = this.current.asReadonly();
  private serial = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, title = 'Operación exitosa'): number {
    return this.show(message, 'success', title, 4500);
  }

  error(message: string, title = 'No se pudo completar'): number {
    return this.show(message, 'error', title, 8000);
  }

  warning(message: string, title = 'Atención'): number {
    return this.show(message, 'warning', title, 6500);
  }

  info(message: string, title = 'Información'): number {
    return this.show(message, 'info', title, 5000);
  }

  show(message: string, type: ToastType = 'info', title = 'Información', durationMs = 5000): number {
    const id = ++this.serial;
    const duration = Math.max(2500, Math.min(durationMs, 15000));
    const toast: AppToast = {
      id, type, title,
      message: String(message || '').trim() || 'La operación ha finalizado.',
      durationMs: duration, closing: false
    };
    // Como máximo 4 avisos: evita tapar la interfaz durante varias respuestas HTTP.
    const existing = this.current();
    for (const old of existing.slice(0, Math.max(0, existing.length - 3))) {
      this.clearTimer(old.id);
    }
    this.current.set([...existing.slice(-3), toast]);
    if (isPlatformBrowser(this.platformId)) {
      this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
    }
    return id;
  }

  dismiss(id: number): void {
    const found = this.current().find(item => item.id === id);
    if (!found || found.closing) return;
    this.clearTimer(id);
    this.current.update(items => items.map(item => item.id === id ? { ...item, closing: true } : item));
    if (isPlatformBrowser(this.platformId)) {
      // Permite reproducir la animación de salida antes de quitar el nodo.
      setTimeout(() => this.remove(id), 320);
    } else {
      this.remove(id);
    }
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(id);
  }

  private remove(id: number): void {
    this.clearTimer(id);
    this.current.update(items => items.filter(item => item.id !== id));
  }
}
