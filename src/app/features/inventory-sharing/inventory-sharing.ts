import { UiControlDirective } from '../../shared/ui/v2/ui-control.directive';
import { UiPageHeadingComponent } from '../../shared/ui/v2/ui-page-heading.component';
import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmationDialogService } from '../../shared/confirm-dialog/confirmation-dialog.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { InventoryService, InventoryShare, InventorySummary } from '../../core/services/inventories';
import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';

@Component({
  selector: 'app-inventory-sharing', standalone: true,
  imports: [UiControlDirective, UiPageHeadingComponent, CommonModule, FormsModule, MatIconModule, MatFormFieldModule, MatSelectModule, LoadingIndicatorComponent],
  templateUrl: './inventory-sharing.html', styleUrl: './inventory-sharing.scss'
})
export class InventorySharingComponent implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly snack = inject(MatSnackBar);
  private readonly confirms = inject(ConfirmationDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platform = inject(PLATFORM_ID);
  myUserId = 0;
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
    if (isPlatformBrowser(this.platform)) {
      try {
        const session = JSON.parse(localStorage.getItem('userSession') || '{}');
        this.myUserId = Number(session.id || 0);
      } catch { this.myUserId = 0; }
    }
    this.refresh();
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
    if (!this.currentInventoryId || !this.identifier.trim() || this.saving) return;
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

  revoke(item: InventoryShare): void {
    this.confirms.confirm({
      title:'Revocar acceso',
      message:`¿Revocar el acceso de «${item.username || 'este usuario'}» al inventario compartido?`,
      confirmLabel:'Revocar acceso',tone:'danger',icon:'person_remove'
    }).subscribe(confirmed=>{
      if(!confirmed)return;
      this.api.revoke(item.id).subscribe({
        next: () => {this.snack.open('Acceso revocado.', 'Cerrar', {duration: 3000});this.loadShares();},
        error: err => this.snack.open(String(err?.error?.error ?? 'No se pudo revocar.'), 'Cerrar', {duration: 6000})
      });
    });
  }
}
