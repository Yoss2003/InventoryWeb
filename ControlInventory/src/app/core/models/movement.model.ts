export interface Movement {
  id?: number;
  articleId: number;
  employeeId?: number;
  actionId: number;
  movementDate: string | Date;
  observation?: string;
  amount: number;
  recipient?: string;
  salePrice?: number;
  documentNumber?: string;
  paymentMethod?: string;
  voucherType?: string;
  customerPhone?: string;
  customerEmail?: string;
  companyId: number;
  photoPath?: string;
}