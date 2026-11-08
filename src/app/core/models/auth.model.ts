export interface LoginRequest {
  username: string;
  password?: string;
  twoFactorCode?: string;
  companyId: number;
}

export interface AuthResponse {
  id: number;
  username: string;
  email?: string;
  token: string;
  roleId: number;
  companyId: number;
}