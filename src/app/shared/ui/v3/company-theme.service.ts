import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/** Solo gobierna colores de interfaz. No modifica sesión, permisos ni datos. */
@Injectable({ providedIn: 'root' })
export class CompanyThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fallback = '#A2D149';

  apply(input?: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const color = typeof input === 'string' && /^#[0-9a-f]{6}$/i.test(input.trim())
      ? input.trim() : this.fallback;
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
    const luminance = rgb.map(c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
    const brightness = luminance[0] * .2126 + luminance[1] * .7152 + luminance[2] * .0722;
    const style = this.document.documentElement.style;
    style.setProperty('--inv-company-accent', color);
    style.setProperty('--inv-company-on-accent', brightness > .179 ? '#12202B' : '#FFFFFF');
  }

  reset(): void { this.apply(null); }
}
