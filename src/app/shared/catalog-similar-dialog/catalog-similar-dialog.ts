import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface CatalogSimilarMatch { id: number; name: string; }
export interface CatalogSimilarData {
  type: string;
  enteredName: string;
  matches: CatalogSimilarMatch[];
}
export type CatalogSimilarChoice = { action: 'reuse'; id: number } | { action: 'create' } | null;

/** Confirmación explícita: el nombre parecido no se fusiona automáticamente. */
@Component({
  selector: 'app-catalog-similar-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="catalog-similar-dialog ui-v2-dialog ui-v2-dialog--simple">
      <h2 mat-dialog-title><mat-icon>warning_amber</mat-icon> Posible duplicado</h2>
      <mat-dialog-content>
        <p>Quieres registrar <strong>{{data.enteredName}}</strong>, pero encontramos {{data.type}} similares.</p>
        <p>Selecciona un registro existente o confirma que deseas crear uno nuevo.</p>
        <div class="match" *ngFor="let item of data.matches">
          <span><strong>{{item.name}}</strong> <small>ID {{item.id}}</small></span>
          <button type="button" (click)="reuse(item.id)">Utilizar</button>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" (click)="cancel()">Cancelar</button>
        <button type="button" class="new" (click)="create()">Crear de todos modos</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .catalog-similar-dialog { background:#17232f; color:#eef5fa; padding:6px; min-width:min(340px,85vw); }
    h2 {display:flex;align-items:center;gap:8px;color:#f4f7fc;font-size:19px}
    h2 mat-icon {color:#e9b763} p {font-size:13px;line-height:1.6}
    .match {display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #425464}
    small {color:#b6c6d4;margin-left:6px}
    button {background:#273b4b;color:#ecf5fd;border:1px solid #657b8d;border-radius:7px;padding:8px 12px;cursor:pointer}
    button.new {background:#99bf4a;color:#17240d;font-weight:700}
    mat-dialog-actions {gap:8px;padding-top:14px}
  `]
})
export class CatalogSimilarDialogComponent {
  readonly data: CatalogSimilarData = inject(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CatalogSimilarDialogComponent, CatalogSimilarChoice>);
  reuse(id: number): void { this.ref.close({ action: 'reuse', id }); }
  create(): void { this.ref.close({ action: 'create' }); }
  cancel(): void { this.ref.close(null); }
}
