import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';
import { Category } from '../../../core/models/category.model';

@Injectable({providedIn:'root'})
export class CategoryService {
  private readonly http=inject(HttpClient);
  private readonly apiUrl='https://localhost:7295/api/Categories';
  private cache$?:Observable<Category[]>;
  getCategories(refresh=false):Observable<Category[]>{
    if(refresh||!this.cache$)this.cache$=this.http.get<Category[]>(this.apiUrl).pipe(
      catchError(error=>{this.cache$=undefined;return throwError(()=>error);}),
      shareReplay({bufferSize:1,refCount:false})
    );
    return this.cache$;
  }
  refreshCategories():Observable<Category[]>{return this.getCategories(true);}
  invalidateCache():void{this.cache$=undefined;}
  createCategory(category:Partial<Category>):Observable<Category>{return this.http.post<Category>(this.apiUrl,category).pipe(tap(()=>this.invalidateCache()));}
  updateCategory(category:Category):Observable<void>{return this.http.put<void>(`${this.apiUrl}/${category.id}`,category).pipe(tap(()=>this.invalidateCache()));}
  deleteCategory(id:number):Observable<void>{return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(tap(()=>this.invalidateCache()));}
}
