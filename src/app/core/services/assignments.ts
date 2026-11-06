import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AssignedArticle {
  id: number;
  articleId: number;
  inventoryId: number;
  articleName: string;
  articleCode: string;
  measurementUnit: string;
  recipientName: string;
  recipientUserId: number | null;
  assignedByUserId: number;
  assignedAt: string;
  quantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
  status: 'Asignado' | 'Devuelto';
  observation?: string;
  hasEvidence?: boolean;
}
export interface AssignmentEvent {
  id: number;
  kind: string;
  quantity: number;
  occurredAt: string;
  observation?: string;
  actorUserId: number;
  movementId: number;
}
export interface AssignmentRecipient { id: number; name: string; }
export interface AssignArticleRequest {
  articleId: number;
  recipientName: string;
  recipientUserId: number | null;
  quantity: number;
  observation?: string;
  operationKey: string;
  detailIds?: number[];
}
@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://localhost:7295/api/Assignments';

  outgoing(): Observable<AssignedArticle[]> { return this.http.get<AssignedArticle[]>(`${this.base}/outgoing`); }
  received(): Observable<AssignedArticle[]> { return this.http.get<AssignedArticle[]>(`${this.base}/received`); }
  events(id: number): Observable<AssignmentEvent[]> { return this.http.get<AssignmentEvent[]>(`${this.base}/${id}/events`); }
  recipients(query = ''): Observable<AssignmentRecipient[]> {
    return this.http.get<AssignmentRecipient[]>(`${this.base}/recipients`, { params: { query } });
  }
  assign(value: AssignArticleRequest): Observable<{id: number}> {
    return this.http.post<{id: number}>(this.base, value);
  }
  uploadEvidence(id: number, file: File): Observable<unknown> {
    const form = new FormData(); form.append('file', file, file.name);
    return this.http.post(`${this.base}/${id}/evidence`, form);
  }
  getEvidence(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/evidence`, { responseType: 'blob' });
  }
  returnArticle(id: number, quantity: number, observation = '', operationKey = crypto.randomUUID(), detailIds: number[] = []): Observable<{ remainingQuantity: number }> {
    return this.http.post<{ remainingQuantity: number }>(`${this.base}/${id}/return`, { quantity, observation, operationKey, detailIds });
  }
}
