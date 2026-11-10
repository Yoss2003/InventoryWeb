import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ApplicationRef,
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';

/**
 * Conserva la selección nativa de MatTabGroup, pero captura su cambio visual
 * antes de que Angular Material actualice el panel. No toca tablas ni datos.
 * La navegación por teclado de Material continúa sin interceptarse.
 */
@Directive({
  selector: 'mat-tab-group[appTabViewTransition]',
  standalone: true
})
export class TabViewTransitionDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly tabGroup = inject(MatTabGroup);
  private readonly appRef = inject(ApplicationRef);
  private readonly zone = inject(NgZone);
  private readonly doc = inject(DOCUMENT);
  private readonly platform = inject(PLATFORM_ID);
  private replaying = false;
  private activeTransitions = 0;

  private readonly captureClick = (event: MouseEvent): void => {
    if (this.replaying || !isPlatformBrowser(this.platform)) return;

    const target = event.target as HTMLElement | null;
    const label = target?.closest<HTMLElement>('.mat-mdc-tab[role="tab"]');
    if (!label || !this.host.nativeElement.contains(label)) return;
    if (label.getAttribute('aria-disabled') === 'true' || label.getAttribute('aria-selected') === 'true') return;

    const labels = Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.mat-mdc-tab[role="tab"]'));
    const nextIndex = labels.indexOf(label);
    if (nextIndex < 0 || nextIndex === this.tabGroup.selectedIndex) return;

    type DocWithTransition = Document & {
      startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
    };
    const doc = this.doc as DocWithTransition;
    const reducedMotion = this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !doc.startViewTransition) return;

    // Se intercepta únicamente el click de una pestaña nueva. La selección
    // se reproduce dentro del snapshot; Material sigue manejando su evento.
    event.preventDefault();
    event.stopImmediatePropagation();

    this.activeTransitions++;
    this.doc.documentElement.classList.add('inv-movement-tab-transition');

    let transition: { finished: Promise<void> };
    try {
      transition = doc.startViewTransition(async () => {
        this.zone.run(() => {
          this.replaying = true;
          try {
            label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } finally {
            this.replaying = false;
          }
          this.appRef.tick();
        });

        // selectedIndexChange de MatTabGroup puede emitirse en un microtask.
        // Otra pasada permite capturar el panel nuevo ya renderizado.
        await Promise.resolve();
        this.zone.run(() => this.appRef.tick());
      });
    } catch {
      // Ante una excepción al iniciar la transición, la pestaña sigue funcionando.
      this.zone.run(() => {
        this.replaying = true;
        try {
          label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        } finally {
          this.replaying = false;
        }
      });
      this.cleanup();
      return;
    }

    void transition.finished.catch(() => undefined).finally(() => this.cleanup());
  };

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platform)) {
      this.host.nativeElement.addEventListener('click', this.captureClick, true);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platform)) {
      this.host.nativeElement.removeEventListener('click', this.captureClick, true);
    }
  }

  private cleanup(): void {
    this.activeTransitions = Math.max(0, this.activeTransitions - 1);
    if (this.activeTransitions === 0) {
      this.doc.documentElement.classList.remove('inv-movement-tab-transition');
    }
  }
}
