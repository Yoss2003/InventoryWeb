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
import { isPlatformBrowser } from '@angular/common';

/**
 * Anima el cambio real de altura de los diálogos sin modificar su contenido
 * ni imponer una altura fija que oculte campos en pantallas pequeñas.
 * El ancho opcional se aplica al pane de CDK, no a otros diálogos.
 */
@Directive({ selector: '[invDialogMotion]', standalone: true })
export class InventoryDialogMotionDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() invDialogMotion: string | number | null = null;
  @Input() invDialogMotionWidth: string | null = null;

  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private initialized = false;
  private knownHeight = 0;
  private nextFrame = 0;
  private animation: Animation | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    if (!this.browser) return;
    this.knownHeight = this.host.getBoundingClientRect().height;
    this.initialized = true;
    // No crear una animación de entrada para el ancho inicial de Artículos.
    if (this.invDialogMotionWidth) {
      this.updatePaneWidth(this.invDialogMotionWidth, false);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.animation && !this.nextFrame) {
          this.knownHeight = this.host.getBoundingClientRect().height;
        }
      });
      this.resizeObserver.observe(this.host);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.browser || !this.initialized) return;
    if (changes['invDialogMotion'] && !changes['invDialogMotion'].firstChange) {
      this.animateNewHeight();
    }
    if (changes['invDialogMotionWidth'] && !changes['invDialogMotionWidth'].firstChange && this.invDialogMotionWidth) {
      this.updatePaneWidth(this.invDialogMotionWidth, true);
    }
  }

  private updatePaneWidth(width: string, animated: boolean): void {
    const pane = (this.host as HTMLElement).closest('.cdk-overlay-pane') as HTMLElement | null;

    if (!pane) return;
    // Mantener el máximo definido por el propio MatDialog.
    if (!animated) {
      pane.style.width = width;
      window.requestAnimationFrame(() => {
        if (pane.isConnected) pane.classList.add('inv-article-motion-width');
      });
    } else {
      pane.classList.add('inv-article-motion-width');
      pane.style.width = width;
    }
  }

  private animateNewHeight(): void {
    // Capturamos la altura anterior antes de que Angular actualice el nuevo panel.
    const start = this.animation
      ? this.host.getBoundingClientRect().height
      : (this.knownHeight || this.host.getBoundingClientRect().height);
    if (this.nextFrame) window.cancelAnimationFrame(this.nextFrame);

    this.zone.runOutsideAngular(() => {
      this.nextFrame = window.requestAnimationFrame(() => {
        this.nextFrame = 0;
        if (!this.host.isConnected) return;
        this.animation?.cancel();
        this.animation = null;
        const end = this.host.getBoundingClientRect().height;
        this.knownHeight = end;
        if (!Number.isFinite(start) || !Number.isFinite(end) || Math.abs(end - start) < 3 ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const animation = this.host.animate(
          [{ height: `${start}px` }, { height: `${end}px` }],
          { duration: 310, easing: 'cubic-bezier(.22, 1, .36, 1)' }
        );
        this.animation = animation;
        animation.finished.then(() => {
          if (this.animation === animation) {
            this.animation = null;
            this.knownHeight = this.host.getBoundingClientRect().height;
          }
        }).catch(() => { /* Una navegación rápida puede cancelar la animación anterior. */ });
      });
    });
  }

  ngOnDestroy(): void {
    if (!this.browser) return;
    if (this.nextFrame) window.cancelAnimationFrame(this.nextFrame);
    this.animation?.cancel();
    this.resizeObserver?.disconnect();
  }
}
