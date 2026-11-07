import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CompanyPublic } from '../../core/models/company-public.model';

@Component({
  selector: 'app-company-selector', standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline" class="company-select" subscriptSizing="dynamic">
      <mat-select [id]="selectId()" aria-label="Empresa / sucursal" [value]="value()"
        [disabled]="disabled() || loading() || !companies().length"
        [placeholder]="loading() ? 'Consultando empresas…' : 'Seleccionar empresa'"
        panelClass="inventory-select-options" (selectionChange)="valueChange.emit($event.value)">
        <mat-option *ngFor="let company of companies()" [value]="company.id">
          {{ company.businessName }}<span *ngIf="duplicate(company)"> (ID {{ company.id }})</span>
        </mat-option>
      </mat-select>
    </mat-form-field>`,
  styles: [':host { display: block; min-width: 0; } .company-select { width: 100%; }']
})
export class CompanySelectorComponent {
  readonly companies = input<CompanyPublic[]>([]);
  readonly value = input<number | null>(null);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly selectId = input('company-selector');
  readonly valueChange = output<number>();
  duplicate(company: CompanyPublic): boolean {
    const name = company.businessName.trim().toLocaleLowerCase('es');
    return this.companies().filter(item => item.businessName.trim().toLocaleLowerCase('es') === name).length > 1;
  }
}
