import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import {
  DevConfirmDialogComponent,
  DevConfirmDialogData
} from './dev-confirm-dialog';

/** Confirmaciones de la aplicación con diseño común, nunca confirm()/prompt() nativos. */
@Injectable({ providedIn: 'root' })
export class ConfirmationDialogService {
  private readonly dialog = inject(MatDialog);

  private open(data: DevConfirmDialogData) {
    return this.dialog.open<DevConfirmDialogComponent, DevConfirmDialogData, boolean | string>(
      DevConfirmDialogComponent, {
        panelClass: ['inv-seven-modal', 'inv-standard-confirm-modal'],
        width: 'min(470px, calc(100vw - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        enterAnimationDuration: 260,
        exitAnimationDuration: 220,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        data
      }
    ).afterClosed();
  }

  confirm(data: DevConfirmDialogData): Observable<boolean> {
    return this.open({ ...data, requiresReason: false })
      .pipe(map(result => result === true));
  }

  requestReason(data: DevConfirmDialogData): Observable<string | null> {
    return this.open({ ...data, requiresReason: true })
      .pipe(map(result => typeof result === 'string' && result.trim()
        ? result.trim()
        : null));
  }
}
