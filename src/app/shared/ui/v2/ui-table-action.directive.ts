import { Directive, input } from '@angular/core';

/** Acción compacta para tablas: dimensiones y foco accesible compartidos. */
@Directive({
  selector: 'button[appUiTableAction]',
  standalone: true,
  host: {
    'class': 'ui-v2-table-action',
    '[class.ui-v2-table-action--danger]': 'tone() === "danger"'
  }
})
export class UiTableActionDirective {
  readonly tone = input<'normal' | 'danger'>('normal', { alias: 'appUiTableAction' });
}
