export type UserRole = 'admin' | 'owner' | 'employee';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_seconds: number;
  user_id: string;
  role: UserRole;
  full_name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  consent_terms: boolean;
}
