import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, effect, inject } from '@angular/core';
import { ToastService, ToastType } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss'
})
export class ToastContainerComponent implements AfterViewInit, OnDestroy {
  /* FASE 4.1 */
  @ViewChild('toastStack', { static: true }) private stack?: ElementRef<HTMLElement>;
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(PLATFORM_ID);
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platform)) return;
    const element = this.stack?.nativeElement;
    if (!element) return;
    this.document.body.appendChild(element); // Escapa del stacking context de app-root.
    if (typeof element.showPopover === 'function') element.showPopover();
  }
  ngOnDestroy(): void {
    const element = this.stack?.nativeElement;
    if (element && isPlatformBrowser(this.platform)) {
      if (typeof element.hidePopover === 'function' && element.matches(':popover-open')) element.hidePopover();
      element.remove();
    }
  }
  readonly alerts = inject(ToastService);
  private latestRaisedToast = 0;
  private readonly keepVisibleAboveDialogs = effect(() => {
    const last = this.alerts.toasts().at(-1)?.id ?? 0;
    if (!last || last <= this.latestRaisedToast) return;
    this.latestRaisedToast = last;
    if (!isPlatformBrowser(this.platform)) return;
    queueMicrotask(() => {
      const element = this.stack?.nativeElement;
      if (!element || typeof element.showPopover !== 'function') return;
      // Nuevo mensaje: mover el popover al final del top-layer, sobre MatDialog.
      if (element.matches(':popover-open')) element.hidePopover();
      element.showPopover();
    });
  });

  icon(type: ToastType): string {
    return type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i';
  }
}
