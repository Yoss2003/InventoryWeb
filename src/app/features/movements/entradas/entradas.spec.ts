import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EntradasComponent } from './entradas';
import { ArticleService } from '../../../core/services/articles';
import { MovementService } from '../../../core/services/movement';

describe('EntradasComponent', () => {
  it('creates and loads empty movements', async () => {
    await TestBed.configureTestingModule({
      imports: [EntradasComponent],
      providers: [
        {provide: ArticleService,useValue:{getArticles:()=>of([])}},
        {provide: MovementService,useValue:{getMovements:()=>of([])}},
        {provide: MatDialog,useValue:{open:()=>({afterClosed:()=>of(false)})}},
        {provide: MatSnackBar,useValue:{open:()=>null}}
      ]
    }).compileComponents();
    const fixture=TestBed.createComponent(EntradasComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.standard).toEqual([]);
  });
});
