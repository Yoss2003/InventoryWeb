import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MovementService } from '../../../core/services/movement';
import { Movement } from '../../../core/models/movement.model';
import { TraspasoFormComponent } from '../traspaso-form/traspaso-form';

@Component({
  selector: 'app-salidas',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatTabsModule, MatIconModule, MatButtonModule],
  templateUrl: './salidas.html',
  styleUrls: ['./salidas.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({height: '0px', minHeight: '0', display: 'none'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class SalidasComponent implements OnInit {
  private movementService = inject(MovementService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);

  traspasos: Movement[] = [];
  ventas: Movement[] = [];
  
  expandedTraspaso: Movement | null = null;
  expandedVenta: Movement | null = null;

  columnsTraspasos = ['movementDate', 'articleId', 'recipient', 'amount', 'actions'];
  columnsVentas = ['movementDate', 'articleId', 'amount', 'salePrice', 'total', 'actions'];

  ngOnInit() {
    this.loadRealData();
  }

  loadRealData() {
    this.movementService.getMovements().subscribe({
      next: (data: Movement[]) => {
        // Ordenamos del más reciente al más antiguo
        const sortedData = data.sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime());
        
        this.ventas = sortedData.filter(m => m.actionId === 2); 
        this.traspasos = sortedData.filter(m => m.actionId === 3 || (m.actionId === 2 && m.observation?.includes('TRASPASO'))); 
        
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error cargando movimientos.', 'Cerrar', { duration: 3000 })
    });
  }

  nuevoTraspaso() {
    const dialogRef = this.dialog.open(TraspasoFormComponent, {
      width: '600px', disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => { if (result) this.loadRealData(); });
  }

  nuevaVenta() {
    console.log("Módulo de ventas (POS) abrirá aquí.");
  }

  anularMovimiento(id: number | undefined, event: Event) {
    event.stopPropagation();
    if (!id) return;
    if (confirm('¿Estás seguro de anular este movimiento/venta? El stock retornará al inventario.')) {
      // AQUÍ IRÍA: this.movementService.deleteMovement(id).subscribe(...)
      this.snackBar.open('Movimiento anulado (Simulación)', 'Cerrar', { duration: 3000 });
      this.loadRealData();
    }
  }
}