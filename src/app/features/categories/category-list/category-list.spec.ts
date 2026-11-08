import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryListComponent } from './category-list';
import { CategoryService } from '../services/category';

describe('CategoryListComponent', () => {
  it('creates and loads categories', async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryListComponent],
      providers: [
        provideNoopAnimations(),
        { provide: CategoryService, useValue: {getCategories: () => of([])} },
        { provide: MatDialog, useValue: {open: () => ({afterClosed: () => of(false)})} },
        { provide: MatSnackBar, useValue: {open: () => null} }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(CategoryListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.dataSource.data).toEqual([]);
    expect(fixture.componentInstance.loading).toBe(false);
  });
});
