import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
export interface SerialUnit { id: number; serialNumber: string; attr1?: string; attr2?: string; attr3?: string; attr4?: string; attr5?: string; attr6?: string; }
@Injectable({providedIn:'root'})
export class SerialUnitsService {
  private readonly http=inject(HttpClient);
  private readonly base='https://localhost:7295/api/serial-units';
  available(articleId:number){return this.http.get<SerialUnit[]>(`${this.base}/${articleId}/available`);}
  assigned(assignmentId:number){return this.http.get<SerialUnit[]>(`${this.base}/assignment/${assignmentId}/pending`);}
  add(articleId:number, data:{serialNumber:string;attr1?:string;attr2?:string;attr3?:string;attr4?:string;attr5?:string;attr6?:string}){
    return this.http.post<{id:number;serialNumber:string}>(`${this.base}/${articleId}`,data);
  }
  addBatch(articleId:number, units:Array<{serialNumber:string;attr1?:string;attr2?:string;attr3?:string;attr4?:string;attr5?:string;attr6?:string}>){
    return this.http.post<{added:number;stock:number;units:Array<{id:number;serialNumber:string}>}>(`${this.base}/${articleId}/batch`,{units});
  }
  decommission(articleId:number, detailId:number, observation:string){
    return this.http.post<{id:number;serialNumber:string;isActive:boolean;stock:number}>(
      `${this.base}/${articleId}/decommission`,{detailId,observation});
  }
}
