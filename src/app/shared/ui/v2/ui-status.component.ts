import { Component, input } from '@angular/core';

/** Etiqueta para estados de filas y tarjetas. */
@Component({
  selector: 'app-ui-status',
  standalone: true,
  template: `<span class="ui-v2-status" [class.ui-v2-status--danger]="tone() === 'danger'"
    [class.ui-v2-status--warning]="tone() === 'warning'"
    [class.ui-v2-status--neutral]="tone() === 'neutral'">{{ label() }}</span>`,
  styles: [`
    :host {display:inline-flex; vertical-align:middle;}
    .ui-v2-status { display:inline-flex;align-items:center; min-height:27px;
      border-radius:100px; border:1px solid color-mix(in srgb, var(--inv-company-accent, #A2D149) 55%, #455a6d); background:color-mix(in srgb, var(--inv-company-accent, #A2D149) 17%, #14212b);
      color:var(--inv-company-accent, #A2D149); padding:4px 10px; box-sizing:border-box;
      font-size:11px; font-weight:700; line-height:1.3; }
    .ui-v2-status--danger {border-color:#86505b;background:#462b32;color:#ffc2c4;}
    .ui-v2-status--warning {border-color:#84683c;background:#423524;color:#ffdea6;}
    .ui-v2-status--neutral {border-color:#577181;background:#253544;color:#d7e6f5;}
  `]
})
export class UiStatusComponent {
  readonly label = input.required<string>();
  readonly tone = input<'success' | 'danger' | 'warning' | 'neutral'>('success');
}
