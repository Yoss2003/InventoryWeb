import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Estado vacío reutilizable; no sustituye las condiciones de carga de cada módulo. */
@Component({
  selector: 'app-ui-empty-state', standalone: true, imports: [MatIconModule],
  template: `<div class="ui-empty"><mat-icon aria-hidden="true">{{icon()}}</mat-icon>
    <strong>{{message()}}</strong><p>{{hint()}}</p></div>`,
  styles: [`
    .ui-empty {display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:7px; min-height:120px; padding:22px;
      box-sizing:border-box; color:#aebfce; text-align:center;}
    mat-icon {width:26px;height:26px;font-size:26px;color:var(--inv-company-accent, #A2D149);}
    strong {font-size:13px;color:#edf4fc;}
    p {font-size:11px;line-height:1.5;margin:0;}
  `]
})
export class UiEmptyStateComponent {
  readonly icon = input('inbox');
  readonly message = input('No hay registros');
  readonly hint = input('');
}
