import { api } from './api';
import { AuthTokens, LoginCredentials, RegisterData, User } from '../types/auth';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await api.post<AuthTokens>('/auth/login', credentials);
    return response.data;
  },

  async register(data: RegisterData): Promise<User> {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Falha silenciosa no logout se token já estiver revogado
    }
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  async recordConsent(consentType: string, policyVersion = '1.0'): Promise<void> {
    await api.post('/auth/consent', {
      consent_type: consentType,
      policy_version: policyVersion,
    });
  },
};
