import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryService } from './category';

describe('CategoryService', () => {
  it('retrieves the categories', () => {
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    const service=TestBed.inject(CategoryService);
    const http=TestBed.inject(HttpTestingController);
    let received: unknown;
    service.getCategories().subscribe(result=>received=result);
    http.expectOne('https://localhost:7295/api/Categories').flush([]);
    expect(received).toEqual([]);
    http.verify();
  });
});
