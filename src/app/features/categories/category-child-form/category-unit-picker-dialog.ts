import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MeasurementUnit } from '../../../core/services/measurement-units';

export interface CategoryUnitPickerData {
  units: MeasurementUnit[];
  selectedIds: number[];
}

/** Selector aislado: no guarda la categoría; solo devuelve los IDs confirmados. */
@Component({
  selector: 'app-category-unit-picker-dialog',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatIconModule],
  templateUrl: './category-unit-picker-dialog.html',
  styleUrl: './category-unit-picker-dialog.scss'
})
export class CategoryUnitPickerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CategoryUnitPickerDialogComponent>);
  private readonly data = inject<CategoryUnitPickerData>(MAT_DIALOG_DATA);

  readonly units: MeasurementUnit[] = [...(this.data.units || [])]
    .sort((a, b) => a.unitName.localeCompare(b.unitName, 'es'));
  readonly selected = new Set<number>((this.data.selectedIds || []).map(Number));
  search = '';

  get visibleUnits(): MeasurementUnit[] {
    const q = this.normalize(this.search);
    if (!q) return this.units;
    return this.units.filter(u => this.normalize(`${u.unitName} ${u.abbreviation ?? ''}`).includes(q));
  }

  get selectedCount(): number { return this.selected.size; }
  get selectedVisibleCount(): number {
    return this.visibleUnits.filter(u => this.selected.has(u.id)).length;
  }
  get allVisibleSelected(): boolean {
    return this.visibleUnits.length > 0 && this.selectedVisibleCount === this.visibleUnits.length;
  }

  private normalize(value: string): string {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  onSearch(event: Event): void {
    this.search = (event.target as HTMLInputElement).value;
  }

  toggle(id: number, checked: boolean): void {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
  }

  selectAllVisible(): void {
    for (const unit of this.visibleUnits) this.selected.add(unit.id);
  }

  clearAllVisible(): void {
    for (const unit of this.visibleUnits) this.selected.delete(unit.id);
  }

  cancel(): void { this.dialogRef.close(); }

  apply(): void {
    if (this.selectedCount === 0) return;
    this.dialogRef.close([...this.selected].sort((a, b) => a - b));
  }

  trackByUnit(_index: number, unit: MeasurementUnit): number { return unit.id; }
}

/* WEBINVENTORY_UNIDADES_UX_V1 */
