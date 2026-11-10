import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Título e icono reutilizables; las acciones permanecen en la pantalla que las ejecuta. */
@Component({
  selector: 'app-ui-page-heading',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="ui-page-heading">
      <span class="ui-page-heading__icon" aria-hidden="true">
        <mat-icon>{{ icon() }}</mat-icon>
      </span>
      <div class="ui-page-heading__copy">
        <h1>{{ title() }}</h1>
        <p>{{ subtitle() }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; flex:1 1 auto; min-width:0; }
    .ui-page-heading { display:flex; align-items:center; gap:13px; min-width:0; }
    .ui-page-heading__icon { width:44px; height:44px; flex:none;
      display:grid; place-items:center; border-radius:11px;
      color:var(--inv-accent,#a8d73d); background:color-mix(in srgb, var(--inv-company-accent, #A2D149) 17%, #14212b);
      border:1px solid color-mix(in srgb, var(--inv-company-accent, #A2D149) 55%, #455a6d); box-sizing:border-box; }
    .ui-page-heading__icon mat-icon { width:23px; height:23px; font-size:23px; }
    .ui-page-heading__copy { min-width:0; }
    .ui-page-heading__copy h1 { margin:0 0 5px; color:var(--inv-text,#edf4fc);
      font-size:21px; font-weight:750; line-height:1.2; }
    .ui-page-heading__copy p { margin:0; color:var(--inv-muted,#a9bac8);
      font-size:12px; line-height:1.45; }
    @media(max-width:600px) { .ui-page-heading__icon {width:40px;height:40px;}
      .ui-page-heading__copy h1 {font-size:19px;} }
  `]
})
export class UiPageHeadingComponent {
  readonly icon = input('inventory_2');
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
