import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  inject
} from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

/**
 * INV_DIALOG_LIFECYCLE_2026_V2
 * Movimiento compartido de los dos formularios: apertura/cierre del host,
 * ancho en el pane de CDK y altura natural al cambiar de panel.
 * No modifica los formularios ni guarda datos.
 */
@Directive({ selector: '[invDialogMotion]', standalone: true })
export class InventoryDialogMotionDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() invDialogMotion: string | number | null = null;
  @Input() invDialogMotionWidth: string | null = null;

  private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private pane: HTMLElement | null = null;
  private opened = false;
  private initialized = false;
  private currentHeight = 0;
  private pendingOldHeight: number | null = null;
  private pendingFrame = 0;
  private heightAnimation: Animation | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly subscriptions = new Subscription();

  constructor() {
    // Este marcador se aplica al crear la vista, antes de su primer fotograma.
    if (this.browser) this.host.classList.add('inv-dialog-motion-root');
  }

  ngAfterViewInit(): void {
    if (!this.browser) return;
    this.pane = this.host.closest('.cdk-overlay-pane') as HTMLElement | null;
    this.pane?.classList.add('inv-dialog-motion-pane');

    // Fijar el ancho inicial ANTES de activar transiciones; nunca animar
    // el ancho que otro modal tenía antes de ser cerrado.
    if (this.invDialogMotionWidth && this.pane) {
      this.pane.style.width = this.invDialogMotionWidth;
    }
    this.currentHeight = this.host.getBoundingClientRect().height;
    this.initialized = true;

    if (this.dialogRef) {
      this.subscriptions.add(this.dialogRef.afterOpened().subscribe(() => {
        if (!this.host.isConnected) return;
        this.opened = true;
        this.currentHeight = this.host.getBoundingClientRect().height;
        // Desde ahora sí se animan los cambios de ancho entre secciones.
        this.pane?.classList.add('inv-dialog-size-ready');
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(() => this.onMeasuredSizeChange());
          this.resizeObserver.observe(this.host);
        }
      }));
      this.subscriptions.add(this.dialogRef.beforeClosed().subscribe(() => {
        this.opened = false;
        this.pane?.classList.remove('inv-dialog-size-ready');
        this.host.classList.add('inv-dialog-closing');
        this.heightAnimation?.cancel();
        this.heightAnimation = null;
      }));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.browser || !this.initialized) return;
    if (changes['invDialogMotion'] && !changes['invDialogMotion'].firstChange) {
      this.scheduleHeightAnimation();
    }
    if (changes['invDialogMotionWidth'] && this.invDialogMotionWidth && this.pane) {
      // El CSS desactiva la transición mientras se completa la apertura.
      this.pane.style.width = this.invDialogMotionWidth;
    }
  }

  private reduceMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private scheduleHeightAnimation(): void {
    if (!this.opened || this.reduceMotion()) return;
    this.pendingOldHeight = this.heightAnimation
      ? this.host.getBoundingClientRect().height
      : (this.currentHeight || this.host.getBoundingClientRect().height);
    if (this.pendingFrame) window.cancelAnimationFrame(this.pendingFrame);
    this.zone.runOutsideAngular(() => {
      this.pendingFrame = window.requestAnimationFrame(() => {
        this.pendingFrame = 0;
        if (!this.opened || !this.host.isConnected) return;
        const from = this.pendingOldHeight;
        this.pendingOldHeight = null;
        if (from == null) return;
        this.heightAnimation?.cancel();
        this.heightAnimation = null;
        // Tras cancelar, vuelve a medirse la altura natural del contenido.
        const to = this.host.getBoundingClientRect().height;
        this.animateHeight(from, to);
      });
    });
  }

  private onMeasuredSizeChange(): void {
    if (!this.opened || this.pendingFrame || this.heightAnimation || this.reduceMotion()) return;
    const to = this.host.getBoundingClientRect().height;
    if (Math.abs(to - this.currentHeight) > 3) {
      this.animateHeight(this.currentHeight, to);
    }
  }

  private animateHeight(from: number, to: number): void {
    if (!Number.isFinite(from) || !Number.isFinite(to) || Math.abs(to - from) < 3) {
      this.currentHeight = to;
      return;
    }
    this.currentHeight = to;
    // Animación de altura real: sin scaleY (los controles no se deforman).
    const animation = this.host.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      { duration: 290, easing: 'cubic-bezier(.22, 1, .36, 1)' }
    );
    this.heightAnimation = animation;
    animation.finished.then(() => {
      if (this.heightAnimation !== animation) return;
      this.heightAnimation = null;
      if (this.host.isConnected) this.currentHeight = this.host.getBoundingClientRect().height;
    }).catch(() => { /* Navegación rápida: la animación anterior se canceló. */ });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (!this.browser) return;
    if (this.pendingFrame) window.cancelAnimationFrame(this.pendingFrame);
    this.heightAnimation?.cancel();
    this.resizeObserver?.disconnect();
    this.pane?.classList.remove('inv-dialog-size-ready', 'inv-dialog-motion-pane');
  }
}
