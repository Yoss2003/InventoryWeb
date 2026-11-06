import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QuickSaleRequest {
  articleId: number;
  quantity: number;
  unitPrice: number;
  customerName: string;
  paymentMethod: string;
  notes: string;
  operationKey: string;
}
@Injectable({providedIn:'root'})
export class SalesService {
  private readonly http=inject(HttpClient);
  private readonly url='https://localhost:7295/api/Sales';
  quickSale(body:QuickSaleRequest):Observable<{saleId:number;total:number}>{return this.http.post<{saleId:number;total:number}>(`${this.url}/quick`,body);}
  getCancellations():Observable<Array<{saleId:number}>>{return this.http.get<Array<{saleId:number}>>(`${this.url}/cancellations`);}
  cancelSale(id:number,reason:string):Observable<void>{return this.http.post<void>(`${this.url}/${id}/cancel`,{reason});}
}
