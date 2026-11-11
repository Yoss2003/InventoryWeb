import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('muestra el símbolo del sol a la izquierda en los valores heredados', () => {
    expect(pipe.transform(80, 'S/.')).toBe('S/ 80.00');
    expect(pipe.transform(2.5, 'PEN')).toBe('S/ 2.50');
    expect(pipe.transform(0, 'S/')).toBe('S/ 0.00');
  });

  it('reconoce monedas diferentes sin convertir los importes', () => {
    expect(pipe.transform(15, 'USD')).toBe('US$ 15.00');
    expect(pipe.transform(15, 'EUR')).toBe('€ 15.00');
  });

  it('respeta tres decimales para cotizaciones', () => {
    expect(pipe.transform(3.36, 'PEN', 3)).toBe('S/ 3.360');
  });

  it('presenta un guion para datos monetarios ausentes o inválidos', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('no-numero')).toBe('—');
  });
});
