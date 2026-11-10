/**
 * Reglas de ingreso WebInventory, alineadas con los Id de MeasurementUnits.
 * El backend almacena Stock y Movement.Amount en la unidad de venta del artículo.
 * No convierte medidas físicas: compra = venta = stock.
 */
export type InventoryUnitKind = 'unit' | 'fixed' | 'pack' | 'measure' | 'unknown';
export interface InventoryUnitInfo {
  id: number;
  name: string;
  kind: InventoryUnitKind;
  factor?: number;
}

const rules: readonly InventoryUnitInfo[] = [
  { id: 1,  name: 'Unidad',         kind: 'unit' },
  { id: 2,  name: 'Contenedor',     kind: 'pack' },
  { id: 3,  name: 'Tarima',         kind: 'pack' },
  { id: 4,  name: 'Master Carton',  kind: 'pack' },
  { id: 5,  name: 'Paquete',        kind: 'pack' },
  { id: 6,  name: 'Docena',         kind: 'fixed', factor: 12 },
  { id: 7,  name: 'Blíster',        kind: 'pack' },
  { id: 8,  name: 'Juego',          kind: 'pack' },
  { id: 9,  name: 'Kilogramo',      kind: 'measure' },
  { id: 10, name: 'Tonelada',       kind: 'measure' },
  { id: 11, name: 'Litro',          kind: 'measure' },
  { id: 12, name: 'Galón',          kind: 'measure' },
  { id: 13, name: 'Metro Lineal',   kind: 'measure' },
  { id: 14, name: 'Metro Cuadrado', kind: 'measure' },
  { id: 15, name: 'Metro Cúbico',   kind: 'measure' },
  { id: 17, name: 'Cajas',          kind: 'pack' },
  { id: 20, name: 'Gramos',         kind: 'measure' },
  { id: 21, name: 'Mililitros',     kind: 'measure' },
  { id: 23, name: 'Metros',         kind: 'measure' },
  { id: 24, name: 'Centímetros',    kind: 'measure' },
  { id: 26, name: 'Pallets',        kind: 'pack' },
  { id: 27, name: 'Libras',         kind: 'measure' },
  { id: 28, name: 'Onzas',          kind: 'measure' },
  { id: 29, name: 'Pares',          kind: 'fixed', factor: 2 }
];

const normalize = (value: string): string => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es')
  .replace(/\s+/g, ' ');

/** Los nombres en la API son UnitName, no las abreviaturas con espacios. */
export function unitRule(name: string, id?: number | null): InventoryUnitInfo {
  const byId = id == null ? undefined : rules.find(rule => rule.id === Number(id));
  if (byId) return byId;
  const key = normalize(String(name || ''));
  const found = rules.find(rule => normalize(rule.name) === key);
  if (found) return found;
  if (key === 'caja') return rules.find(rule => rule.id === 17)!;
  if (key === 'unidades' || key === 'und') return rules[0];
  if (key === 'kilos' || key === 'kgs') return rules.find(rule => rule.id === 9)!;
  if (key === 'litros' || key === 'lts') return rules.find(rule => rule.id === 11)!;
  return { id: -1, name, kind: 'unknown' };
}

export function isMeasuredUnit(name: string): boolean { return unitRule(name).kind === 'measure'; }
export function isUnitName(name: string): boolean { return unitRule(name).kind === 'unit'; }
export function isPackUnit(name: string): boolean { return ['pack','fixed'].includes(unitRule(name).kind); }
export function fixedUnitFactor(name: string): number | null { return unitRule(name).factor ?? null; }
export function quantityStep(name: string): number { return isMeasuredUnit(name) ? 0.1 : 1; }

/**
 * El ingreso se convierte a piezas solo cuando se compra un empaque y se vende por Unidad.
 * Si se compra una medida física, no hay conversión y se exige unidad igual en venta.
 */
export function isUnitConversion(purchase: string, sale: string): boolean {
  return isPackUnit(purchase) && isUnitName(sale) && normalize(purchase) !== normalize(sale);
}

/** Aceptamos hasta dos decimales por Stock decimal(18,2) en ApiInventory. */
export function validQuantity(value: unknown, unit: string, positive = false): boolean {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  if (!Number.isFinite(num) || num < (positive ? Number.EPSILON : 0)) return false;
  if (isMeasuredUnit(unit)) return Math.abs(num * 100 - Math.round(num * 100)) < 1e-7;
  return Number.isSafeInteger(num);
}

export function validPieces(value: unknown, positive = false): boolean {
  if (value === null || value === undefined || value === '') return false;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= (positive ? 1 : 0);
}

export function convertedStock(quantity: number, factor: number, convert: boolean): number {
  const result = convert ? quantity * factor : quantity;
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

export function quantityLabel(unit: string): string {
  const special: Record<string, string> = {
    'cajas': 'cajas', 'caja': 'cajas', 'docena': 'docenas',
    'paquete': 'paquetes', 'blister': 'blísteres', 'par(es)': 'pares',
    'pares': 'pares', 'juego': 'juegos', 'contenedor': 'contenedores',
    'tarima': 'tarimas', 'pallets': 'pallets', 'master carton': 'master cartons'
  };
  const key = normalize(unit);
  return 'Cantidad de ' + (special[key] || unit.toLocaleLowerCase('es'));
}

/* WEBINVENTORY_UNIDADES_INGRESOS_2026_V1: rules */
