/** Coincide con ControlInventario.Shared.Models.Brand (JSON camelCase). */
export interface Brand {
  id: number;
  inventoryId: number;
  categoryId: number;
  name: string;
  companyId: number;
  isActive: boolean;
}

export type CreateBrandRequest = Pick<Brand, 'inventoryId' | 'categoryId' | 'name'> &
  Partial<Pick<Brand, 'isActive'>>;
