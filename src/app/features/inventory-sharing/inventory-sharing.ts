import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { InventoryService, InventoryShare, InventorySummary } from '../../core/services/inventories';

@Component({
  selector: 'app-inventory-sharing', standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './inventory-sharing.html', styleUrl: './inventory-sharing.scss'
})
export class InventorySharingComponent implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly snack = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platform = inject(PLATFORM_ID);
  myUserId = 0;
  inventories: InventorySummary[] = [];
  currentInventoryId: number | null = null;
  shares: InventoryShare[] = [];
  identifier = '';
  accessLevel: 1 | 2 = 1;
  loading = false;
  saving = false;
  error = '';

  get labelCount(): Map<string, number> {
    const counts=new Map<string, number>();
    for(const inv of this.ownedInventories){
      const label=(inv.alias||inv.inventoryName||'Sin nombre').trim().toLocaleLowerCase('es');
      counts.set(label,(counts.get(label)||0)+1);
    }
    return counts;
  }
  inventoryLabel(inv:InventorySummary):string {
    const label=(inv.alias||inv.inventoryName||'Sin nombre').trim();
    return (this.labelCount.get(label.toLocaleLowerCase('es'))||0)>1 ? `${label} · ID ${inv.id}` : label;
  }
  get ownedInventories(): InventorySummary[] {
    return this.inventories.filter(x => x.userId === this.myUserId && x.isActive);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platform)) {
      try {
        const session = JSON.parse(localStorage.getItem('userSession') || '{}');
        this.myUserId = Number(session.id || 0);
      } catch { this.myUserId = 0; }
    }
    this.refresh();
  }

  refresh(): void {
    this.loading = true; this.error = '';
    this.api.getInventories().subscribe({
      next: values => {
        this.inventories = values;
        if (!this.ownedInventories.some(x => x.id === this.currentInventoryId))
          this.currentInventoryId = this.ownedInventories[0]?.id ?? null;
        this.loading = false;
        if (this.currentInventoryId) this.loadShares();
        else this.shares = [];
        this.cdr.markForCheck();
      },
      error: () => {this.loading = false; this.error = 'No se pudieron consultar los inventarios.'; this.cdr.markForCheck();}
    });
  }

  loadShares(): void {
    if (!this.currentInventoryId) { this.shares = []; return; }
    this.api.getShares(this.currentInventoryId).subscribe({
      next: data => {this.shares = data; this.error = ''; this.cdr.markForCheck();},
      error: (err) => {this.shares = []; this.error = String(err?.error?.error || 'No se pudieron consultar los permisos de este inventario.'); this.cdr.markForCheck();}
    });
  }

  share(): void {
    if (!this.currentInventoryId || !this.identifier.trim() || this.saving) return;
    this.saving = true;
    this.api.share(this.currentInventoryId, this.identifier.trim(), this.accessLevel).subscribe({
      next: () => {
        this.saving = false;
        this.identifier = '';
        this.snack.open('Acceso otorgado al inventario.', 'Cerrar', {duration: 3300});
        this.loadShares();
      },
      error: err => {
        this.saving = false;
        this.snack.open(String(err?.error?.error ?? 'No se pudo compartir el inventario.'), 'Cerrar', {duration: 6000});
      }
    });
  }

  revoke(item: InventoryShare): void {
    if (!confirm(`¿Revocar el acceso de ${item.username || 'este usuario'}?`)) return;
    this.api.revoke(item.id).subscribe({
      next: () => {this.snack.open('Acceso revocado.', 'Cerrar', {duration: 3000});this.loadShares();},
      error: err => this.snack.open(String(err?.error?.error ?? 'No se pudo revocar.'), 'Cerrar', {duration: 6000})
    });
  }
}
