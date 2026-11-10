import { Directive } from '@angular/core';

/** Estilo de campos opt-in: preserva formControlName, ngModel, validadores y eventos. */
@Directive({
  selector: 'input[appUiControl], textarea[appUiControl], select[appUiControl]',
  standalone: true,
  host: { 'class': 'ui-v2-control' }
})
export class UiControlDirective {}
