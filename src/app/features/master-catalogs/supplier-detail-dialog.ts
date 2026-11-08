/* FASE 4.1.2 — Modal de consulta de proveedores */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { SupplierRecord } from './master-catalogs';

interface FiscalRow { label: string; value: string; }

@Component({
  selector: 'app-supplier-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './supplier-detail-dialog.html',
  styleUrl: './supplier-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierDetailDialogComponent {
  readonly item = inject<SupplierRecord>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SupplierDetailDialogComponent>>(MatDialogRef);
  readonly fiscalRows = this.readFiscalRows();

  close(): void { this.dialogRef.close(); }

  private readFiscalRows(): FiscalRow[] {
    let values: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(this.item.fiscalDataJson || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        values = parsed as Record<string, unknown>;
      }
    } catch { /* Proveedor histórico: sin instantánea JSON válida. */ }

    const fields: Array<[string, string]> = [
      ['tipo', 'Tipo de contribuyente'],
      ['actividad_economica', 'Actividad económica'],
      ['ubigeo', 'Ubigeo'],
      ['numero_trabajadores', 'Número de trabajadores'],
      ['tipo_facturacion', 'Tipo de facturación'],
      ['tipo_contabilidad', 'Tipo de contabilidad'],
      ['comercio_exterior', 'Comercio exterior'],
      ['via_tipo', 'Tipo de vía'],
      ['via_nombre', 'Nombre de vía'],
      ['zona_codigo', 'Código de zona'],
      ['zona_tipo', 'Nombre de zona'],
      ['numero', 'Número de dirección'],
      ['interior', 'Interior'],
      ['lote', 'Lote'],
      ['dpto', 'Departamento / oficina'],
      ['manzana', 'Manzana'],
      ['kilometro', 'Kilómetro'],
      ['es_agente_retencion', 'Agente de retención'],
      ['es_buen_contribuyente', 'Buen contribuyente']
    ];
    return fields.flatMap(([key, label]) => {
      const value = values[key];
      if (value == null || value === '' || value === '-') return [];
      if (typeof value === 'boolean') return [{ label, value: value ? 'Sí' : 'No' }];
      return [{ label, value: String(value) }];
    });
  }
}
