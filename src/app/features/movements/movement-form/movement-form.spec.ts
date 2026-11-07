
import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { MovementForm } from './movement-form';
import { ArticleService } from '../../../core/services/articles';
import { MovementService } from '../../../core/services/movement';

describe('MovementForm', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovementForm],
      providers: [
        {
          provide: MatDialogRef,
          useValue: { close: () => {} }
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { actionId: 1 }
        },
        {
          provide: ArticleService,
          useValue: {
            getArticles: () => of([])
          }
        },
        {
          provide: MovementService,
          useValue: {
            createMovement: () => of({})
          }
        },
        {
          provide: MatSnackBar,
          useValue: {
            open: () => {}
          }
        }
      ]
    }).compileComponents();
  });

  it('debe crear el formulario correctamente', async () => {
    const fixture = TestBed.createComponent(MovementForm);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('debe finalizar la carga inicial', async () => {
    const fixture = TestBed.createComponent(MovementForm);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.articles).toEqual([]);
  });

  it('no debe permitir guardar sin seleccionar un artículo', async () => {
    const fixture = TestBed.createComponent(MovementForm);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.canSave).toBe(false);
  });

});