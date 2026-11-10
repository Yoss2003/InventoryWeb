import { Directive, input } from '@angular/core';

/** Clase y rol visual consistentes sin modificar el (click) ni el formulario. */
@Directive({
  selector: 'button[appUiButton]',
  standalone: true,
  host: {
    'class': 'ui-v2-button',
    '[class.ui-v2-button--primary]': 'tone() === "primary"',
    '[class.ui-v2-button--secondary]': 'tone() === "secondary"',
    '[class.ui-v2-button--danger]': 'tone() === "danger"'
  }
})
export class UiButtonDirective {
  readonly tone = input<'primary' | 'secondary' | 'danger'>('secondary', { alias: 'appUiButton' });
}
