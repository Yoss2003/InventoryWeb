/** Respuesta pública de GET /api/Companies/Active. No incluye RUC ni datos privados. */
export interface CompanyPublic {
  id: number;
  businessName: string;
  logoUrl?: string | null;
  primaryColorHex?: string | null;
}
