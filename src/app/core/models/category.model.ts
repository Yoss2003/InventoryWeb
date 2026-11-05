export interface Category {
  id: number;
  inventoryId: number;
  name: string;
  description?: string;
  isActive: boolean;
  companyId: number;

  parentCategoryId?: number | null;
  trackingMode?: string;
  namingMethod?: string;
  isReturnable?: boolean;
  selectedUnitIds?: number[];

  label1?: string;
  isUnique1?: boolean;
  label2?: string;
  isUnique2?: boolean;
  label3?: string;
  isUnique3?: boolean;
  label4?: string;
  isUnique4?: boolean;
  label5?: string;
  isUnique5?: boolean;
  label6?: string;
  isUnique6?: boolean;

  creationDate?: Date | string;
  creationUser?: string;

  subcategorias?: Category[];
}