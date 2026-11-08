import { Component, input } from '@angular/core';

/** Indicador de carga local y reutilizable. No bloquea otras secciones. */
@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  template: `
    <span class="loading-state" [class.loading-state--compact]="compact()" role="status" aria-live="polite">
      <span class="loading-wheel" aria-hidden="true"></span>
      @if (message()) { <span>{{ message() }}</span> }
    </span>
  `,
  styles: [`
    :host {display:inline-flex;vertical-align:middle;max-width:100%;}
    .loading-state {display:inline-flex;align-items:center;justify-content:center;gap:10px;
      min-height:42px;padding:10px;color:#c6d8e8;font-size:13px;font-weight:600;}
    .loading-state--compact {padding:0;min-height:0;gap:7px;color:inherit;font-size:inherit;}
    .loading-wheel {display:inline-block;box-sizing:border-box;width:21px;height:21px;flex:none;
      border:2.5px solid rgba(163,189,215,.4);border-top-color:#a7d84b;border-radius:50%;animation:uiRotate .7s linear infinite;}
    .loading-state--compact .loading-wheel {width:15px;height:15px;border-width:2px;}
    @keyframes uiRotate {to {transform:rotate(360deg);}}
    @media (prefers-reduced-motion:reduce) {.loading-wheel{animation-duration:2s;}}
  `]
})
export class LoadingIndicatorComponent {
  readonly message = input('Cargando...');
  readonly compact = input(false);
}
