import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ArticleListComponent } from './article-list';
import { ArticleService } from '../../../core/services/articles';
import { CategoryService } from '../../categories/services/category';
import { BrandService } from '../../../core/services/brands';

describe('ArticleListComponent', () => {
  it('creates and loads an empty catalog', async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleListComponent],
      providers: [
        { provide: ArticleService, useValue: {getArticles: () => of([])} },
        { provide: CategoryService, useValue: {getCategories: () => of([])} },
        { provide: BrandService, useValue: {getBrands: () => of([])} },
        { provide: MatDialog, useValue: {open: () => ({afterClosed: () => of(false)})} },
        { provide: MatSnackBar, useValue: {open: () => null} }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(ArticleListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.dataSource).toEqual([]);
  });
});
