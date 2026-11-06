export interface ArticleDetail {
  id?: number;
  articleId?: number;
  serialNumber: string;
  attr1?: string | null;
  attr2?: string | null;
  attr3?: string | null;
  attr4?: string | null;
  attr5?: string | null;
  attr6?: string | null;
  isActive?: boolean;
}

export interface Article {
  id: number;
  inventoryId: number;
  categoryId: number;
  brandId?: number | null;
  companyId?: number;
  code: string;
  barcode?: string | null;
  name: string;
  model: string;
  serialNumber?: string | null;
  presentation?: string | null;
  tracking: number;
  trackingMode?: string | number;
  stock: number;
  measurementUnit: string;
  acquisitionUnit?: string | null;
  saleUnit?: string | null;
  conversionFactor?: number | null;
  acquisitionPrice?: number | null;
  acquisitionCurrency?: string | null;
  salePrice?: number | null;
  saleCurrency?: string | null;
  characteristics?: string | null;
  mainPhotoPath?: string | null;
  mainVoucherPath?: string | null;
  isActive: boolean;
  details?: ArticleDetail[];
  articleDetails?: ArticleDetail[];
  actionId?: number;
  registrationDate?: string;
}
