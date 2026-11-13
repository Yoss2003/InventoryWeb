import { UiControlDirective } from '../../shared/ui/v2/ui-control.directive';
import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmationDialogService } from '../../shared/confirm-dialog/confirmation-dialog.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { InventoryService, InventoryShare, InventorySummary } from '../../core/services/inventories';
import { AccessService } from '../../core/services/access';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';

@Component({
  selector: 'app-inventory-sharing', standalone: true,
  imports: [UiControlDirective, UiPageHeadingComponent, CommonModule, FormsModule, MatIconModule, MatFormFieldModule, MatSelectModule, LoadingIndicatorComponent],
  templateUrl: './inventory-sharing.html', styleUrl: './inventory-sharing.scss'
})
export class InventorySharingComponent implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly access = inject(AccessService);
  private readonly snack = inject(MatSnackBar);
  private readonly confirms = inject(ConfirmationDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  myUserId = 0;
  canManageAccess = false;
  inventories: InventorySummary[] = [];
  currentInventoryId: number | null = null;
  shares: InventoryShare[] = [];
  identifier = '';
  accessLevel: 1 | 2 = 1;
  loading = false;
  hasLoaded = false;
  loadingShares = false;
  sharesLoaded = false;
  saving = false;
  updatingShareId: number | null = null;
  error = '';
  private requestId = 0;
  private loadedSharesInventoryId: number | null = null;

  get ownedInventories(): InventorySummary[] {
    return this.inventories.filter(x => x.userId === this.myUserId && x.isActive && !x.isMaster);
  }
  get labelCount(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const inv of this.ownedInventories) {
      const key = (inv.alias || inv.inventoryName || 'Sin nombre').trim().toLocaleLowerCase('es');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }
  inventoryLabel(inv: InventorySummary): string {
    const label = (inv.alias || inv.inventoryName || 'Sin nombre').trim();
    return (this.labelCount.get(label.toLocaleLowerCase('es')) || 0) > 1 ? `${label} · ID ${inv.id}` : label;
  }

  ngOnInit(): void {
    this.access.me().subscribe({
      next: snapshot => {
        this.myUserId = snapshot.userId;
        this.canManageAccess = (snapshot.permissions || []).includes('MANAGE_INVENTORY_ACCESS');
        this.refresh();
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron verificar los permisos de la sesión.';
        this.cdr.markForCheck();
      }
    });
  }

  refresh(): void {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    this.api.getInventories().subscribe({
      next: values => {
        this.inventories = values;
        if (!this.ownedInventories.some(x => x.id === this.currentInventoryId)) {
          this.currentInventoryId = this.ownedInventories[0]?.id ?? null;
          this.shares = [];
          this.sharesLoaded = false;
          this.loadedSharesInventoryId = null;
        }
        this.loading = false;
        this.hasLoaded = true;
        if (this.currentInventoryId) this.loadShares();
        else { this.requestId++; this.shares = []; this.loadingShares = false; }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.hasLoaded = true;
        this.error = 'No se pudieron consultar los inventarios. Los datos anteriores pueden estar desactualizados.';
        this.cdr.markForCheck();
      }
    });
  }

  loadShares(): void {
    const inventoryId = this.currentInventoryId;
    if (!inventoryId) { this.shares = []; this.sharesLoaded = false; this.loadingShares = false; this.requestId++; this.cdr.markForCheck(); return; }
    const requestId = ++this.requestId;
    this.loadingShares = true;
    if (this.loadedSharesInventoryId !== inventoryId) {
      this.sharesLoaded = false;
      this.shares = []; // Al cambiar de almacén no se exhiben permisos del anterior.
      this.loadedSharesInventoryId = inventoryId;
    }
    this.cdr.markForCheck();
    this.api.getShares(inventoryId).subscribe({
      next: data => {
        if (requestId !== this.requestId || inventoryId !== this.currentInventoryId) return;
        this.shares = data;
        this.sharesLoaded = true;
        this.loadingShares = false;
        this.error = '';
        this.cdr.markForCheck();
      },
      error: err => {
        if (requestId !== this.requestId || inventoryId !== this.currentInventoryId) return;
        this.shares = [];
        this.sharesLoaded = true;
        this.loadingShares = false;
        this.error = String(err?.error?.error || 'No se pudieron consultar los permisos de este inventario.');
        this.cdr.markForCheck();
      }
    });
  }

  share(): void {
    if (!this.canManageAccess || !this.currentInventoryId || !this.identifier.trim() || this.saving) return;
    this.saving = true;
    this.cdr.markForCheck();
    this.api.share(this.currentInventoryId, this.identifier.trim(), this.accessLevel).subscribe({
      next: () => {
        this.saving = false;
        this.identifier = '';
        this.snack.open('Acceso otorgado al inventario.', 'Cerrar', {duration: 3300});
        this.loadShares();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.snack.open(String(err?.error?.error ?? 'No se pudo compartir el inventario.'), 'Cerrar', {duration: 6000});
        this.cdr.markForCheck();
      }
    });
  }

  changeAccess(item: InventoryShare): void {
    if (!this.canManageAccess || this.updatingShareId !== null) return;
    const nextAccess: 1 | 2 = item.accessLevel === 2 ? 1 : 2;
    const nextLabel = nextAccess === 2 ? 'Editor' : 'Lector';
    this.confirms.confirm({
      title: 'Cambiar permiso',
      message: `¿Cambiar el acceso de «${item.username || 'este usuario'}» a ${nextLabel}?`,
      confirmLabel: `Cambiar a ${nextLabel}`, tone: 'primary', icon: 'swap_horiz'
    }).subscribe(confirmed => {
      if (!confirmed || !this.canManageAccess || this.updatingShareId !== null) return;
      this.updatingShareId = item.id;
      this.api.updateShareAccess(item.id, nextAccess).subscribe({
        next: () => {
          this.shares = this.shares.map(row => row.id === item.id ? { ...row, accessLevel: nextAccess } : row);
          this.updatingShareId = null;
          this.snack.open(`Permiso actualizado a ${nextLabel}.`, 'Cerrar', { duration: 3000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.updatingShareId = null;
          this.snack.open(String(err?.error?.error ?? 'No se pudo actualizar el permiso.'), 'Cerrar', { duration: 6000 });
          this.cdr.markForCheck();
        }
      });
    });
  }

  revoke(item: InventoryShare): void {
    if (!this.canManageAccess) return;
    this.confirms.confirm({
      title:'Revocar acceso',
      message:`¿Revocar el acceso de «${item.username || 'este usuario'}» al inventario compartido?`,
      confirmLabel:'Revocar acceso',tone:'danger',icon:'person_remove'
    }).subscribe(confirmed=>{
      if(!confirmed || !this.canManageAccess)return;
      this.api.revoke(item.id).subscribe({
        next: () => {this.snack.open('Acceso revocado.', 'Cerrar', {duration: 3000});this.loadShares();},
        error: err => this.snack.open(String(err?.error?.error ?? 'No se pudo revocar.'), 'Cerrar', {duration: 6000})
      });
    });
  }
}
