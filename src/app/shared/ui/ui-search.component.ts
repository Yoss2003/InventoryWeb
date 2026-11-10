import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Buscador visual reutilizable. No altera datos ni ejecuta peticiones:
 * el contenedor decide cómo aplicar el filtro.
 */
@Component({
  selector: 'app-ui-search',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <label class="ui-search-box">
      <mat-icon aria-hidden="true">search</mat-icon>
      <input
        type="search"
        autocomplete="off"
        [value]="value()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [attr.aria-label]="label()"
        (input)="valueChange.emit($any($event.target).value)"
      />
    </label>
  `,
  styles: [`
    :host { display:block; flex:0 1 var(--inv-search-width,420px);
      width:min(100%,var(--inv-search-width,420px)); min-width:0; }
    .ui-search-box { display:flex; align-items:center; gap:9px; width:100%;
      min-width:0; height:var(--inv-control-height,43px);
      box-sizing:border-box; padding:0 12px;
      background:var(--inv-input-bg,#101a24);
      border:1px solid var(--inv-input-border,#60788a);
      border-radius:var(--inv-radius-control,9px); color:#a6bac9;
      transition:border-color .15s, box-shadow .15s; }
    .ui-search-box:hover { border-color:#91a8b7; }
    .ui-search-box:focus-within { border-color:var(--inv-accent,#a8d73d);
      box-shadow:0 0 0 2px color-mix(in srgb, var(--inv-company-accent, #A2D149) 13%, transparent); }
    mat-icon { width:19px; height:19px; font-size:19px; flex:none; }
    input { flex:1; min-width:0; width:100%; height:100%;
      border:0; outline:0; box-shadow:none; background:transparent;
      color:var(--inv-text,#edf4fc); font:inherit; font-size:12px; }
    input::placeholder { color:var(--inv-muted,#a9bac8); opacity:1; }
    input:disabled { cursor:not-allowed; opacity:.6; }
    @media(max-width:720px) { :host { width:100%; flex:1 1 100%; max-width:none; } }
  `]
})
export class UiSearchComponent {
  readonly value = input<string>('');
  readonly valueChange = output<string>();
  readonly placeholder = input<string>('Buscar...');
  readonly label = input<string>('Buscar registros');
  readonly disabled = input<boolean>(false);
}
