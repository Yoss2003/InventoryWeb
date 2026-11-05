export interface Article {
  id: number;
  inventoryId: number;
  categoryId: number;
  brandId?: number;
  code: string;
  barcode?: string;
  name: string;
  model: string;
  stock: number;
  measurementUnit: string;
  acquisitionPrice?: number;
  salePrice?: number;
  trackingMode?: string;
  isActive: boolean;
  articleDetails?: any[];
}