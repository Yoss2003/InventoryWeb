import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formato monetario único para las vistas del inventario.
 * Solo cambia la representación; no convierte monedas ni redondea valores de la API.
 *
 * Ejemplos: 80 + 'S/.' => 'S/ 80.00', 2.5 + 'PEN' => 'S/ 2.50',
 * 15 + 'USD' => 'US$ 15.00', 3.36 + 'PEN' + 3 => 'S/ 3.360'.
 */
@Pipe({ name: 'money', standalone: true, pure: true })
export class MoneyPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    currency: string | null | undefined = 'PEN',
    decimals = 2
  ): string {
    if (value === null || value === undefined || value === '') return '—';
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(amount)) return '—';

    const code = String(currency || 'PEN').trim().toUpperCase();
    const symbol =
      ['PEN', 'S/', 'S/.', 'SOL', 'SOLES'].includes(code) ? 'S/' :
      ['USD', 'US$', '$'].includes(code) ? 'US$' :
      ['EUR', '€'].includes(code) ? '€' : code;

    const digits = Number.isInteger(decimals) && decimals >= 0 && decimals <= 6
      ? decimals : 2;
    const amountText = new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(amount);

    return `${symbol} ${amountText}`;
  }
}
