import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { UiButtonDirective } from '../../shared/ui/v2/ui-button.directive';
import { UiTableActionDirective } from '../../shared/ui/v2/ui-table-action.directive';
import { ToastService } from '../../shared/toast/toast.service';
import { AccessService } from '../../core/services/access';

interface MasterInventory {
  id: number; companyId: number; companyName: string;
  inventoryName: string; alias?: string; isActive: boolean;
}
interface CatalogPreview {
  id: number; companyId: number; inventoryName: string;
  categories: { id: number; name: string; parentCategoryId?: number | null }[];
  brands: { id: number; name: string; categoryId: number }[];
  suppliers: { id: number; ruc: string; businessName: string }[];
}
@Component({
  selector: 'app-master-inventories',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink,
    UiPageHeadingComponent, UiButtonDirective, UiTableActionDirective],
  templateUrl: './master-inventories.html',
  styleUrl: './master-inventories.scss'
})
export class MasterInventoriesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly access = inject(AccessService);
  private readonly api = 'https://localhost:7295/api/Inventories';
  loading = false;
  loadingCatalog = false;
  isDeveloper = false;
  companyId = 0;
  query = '';
  masters: MasterInventory[] = [];
  selected: MasterInventory | null = null;
  catalog: CatalogPreview | null = null;
  error = '';

  get filtered(): MasterInventory[] {
    const q = this.query.trim().toLocaleLowerCase('es');
    return this.masters.filter(m => !q ||
      [m.companyName, m.inventoryName, String(m.companyId)]
        .some(v => v.toLocaleLowerCase('es').includes(q)));
  }
  get sameCompany(): boolean {
    return this.selected !== null && this.selected.companyId === this.companyId;
  }

  ngOnInit(): void {
    this.access.me().subscribe({
      next: info => { this.isDeveloper = info.isDeveloper; this.companyId = info.companyId; this.load(); },
      error: () => { this.error = 'No se pudieron comprobar los permisos de la sesión.'; }
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<MasterInventory[]>(`${this.api}/masters`).subscribe({
      next: items => {
        this.masters = items || [];
        this.loading = false;
        if (this.selected) {
          this.selected = this.masters.find(x => x.id === this.selected?.id) || null;
          if (!this.selected) this.catalog = null;
        }
        if (!this.selected && this.masters.length === 1) this.inspect(this.masters[0]);
      },
      error: e => {
        this.loading = false;
        this.error = String(e?.error?.error || 'No se pudieron cargar los inventarios maestros.');
        this.toast.error(this.error);
      }
    });
  }
  inspect(master: MasterInventory): void {
    this.selected = master;
    this.catalog = null;
    this.loadingCatalog = true;
    this.http.get<CatalogPreview>(`${this.api}/masters/${master.id}/catalogs`).subscribe({
      next: value => { this.catalog = value; this.loadingCatalog = false; },
      error: e => {
        this.loadingCatalog = false;
        this.toast.error(String(e?.error?.error || 'No se pudo consultar el catálogo.'));
      }
    });
  }
}
