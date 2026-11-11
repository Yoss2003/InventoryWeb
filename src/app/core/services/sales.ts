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
  detailIds?: number[];
  installmentFrequency?: string;
  installmentCount?: number;
  downPayment?: number;

}
export interface SaleInstallmentReceipt { id: number; amount: number; paidAt: string; paymentMethod: string; receivedByUserId: number; notes?: string | null; }
export interface SaleInstallmentRow { id: number; installmentNumber: number; installmentAmount: number; paidAmount: number; balance: number; dueDate: string; frequency: string; status: string; receipts: SaleInstallmentReceipt[]; }
export interface SaleInstallmentsSummary { saleId: number; totalAmount: number; amountReceived: number | null; downPayment: number | null; financedAmount: number; balance: number; cancelled: boolean; installments: SaleInstallmentRow[]; }
@Injectable({providedIn:'root'})
export class SalesService {
  private readonly http=inject(HttpClient);
  private readonly url='https://localhost:7295/api/Sales';
  quickSale(body:QuickSaleRequest):Observable<{saleId:number;total:number}>{return this.http.post<{saleId:number;total:number}>(`${this.url}/quick`,body);}
  getInstallments(saleId: number): Observable<SaleInstallmentsSummary> { return this.http.get<SaleInstallmentsSummary>(`${this.url}/${saleId}/installments`); }
  getCancellations():Observable<Array<{saleId:number}>>{return this.http.get<Array<{saleId:number}>>(`${this.url}/cancellations`);}
  cancelSale(id:number,reason:string):Observable<void>{return this.http.post<void>(`${this.url}/${id}/cancel`,{reason});}
}
