import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../services/authService';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('Frontend authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs login and returns auth tokens', async () => {
    const mockResponse = {
      data: {
        access_token: 'fake_access_jwt',
        refresh_token: 'fake_refresh_token',
        token_type: 'bearer',
        expires_in_seconds: 1800,
        user_id: 'uuid-1234',
        role: 'owner',
        full_name: 'Proprietário Teste',
      },
    };
    (api.post as any).mockResolvedValueOnce(mockResponse);

    const result = await authService.login({
      email: 'owner@teste.com',
      password: 'Password123!',
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'owner@teste.com',
      password: 'Password123!',
    });
    expect(result.access_token).toBe('fake_access_jwt');
    expect(result.role).toBe('owner');
  });

  it('performs register and returns new user entity', async () => {
    const mockUser = {
      data: {
        id: 'new-user-uuid',
        full_name: 'Novo Gestor',
        email: 'gestor@teste.com',
        role: 'owner',
        phone: '48999991234',
        is_active: true,
      },
    };
    (api.post as any).mockResolvedValueOnce(mockUser);

    const result = await authService.register({
      full_name: 'Novo Gestor',
      email: 'gestor@teste.com',
      password: 'Password123!',
      role: 'owner',
      phone: '48999991234',
      consent_terms: true,
    });

    expect(api.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
      email: 'gestor@teste.com',
      role: 'owner',
    }));
    expect(result.id).toBe('new-user-uuid');
    expect(result.email).toBe('gestor@teste.com');
  });

  it('handles logout gracefully even when api rejects', async () => {
    (api.post as any).mockRejectedValueOnce(new Error('Network error or token already revoked'));

    // Should not throw
    await expect(authService.logout('old_token')).resolves.toBeUndefined();
    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refresh_token: 'old_token' });
  });

  it('records LGPD consent with correct payload', async () => {
    (api.post as any).mockResolvedValueOnce({ data: {} });

    await authService.recordConsent('privacy_policy', '2.0');

    expect(api.post).toHaveBeenCalledWith('/auth/consent', {
      consent_type: 'privacy_policy',
      policy_version: '2.0',
    });
  });

  it('changes password with current and new password', async () => {
    (api.post as any).mockResolvedValueOnce({ data: {} });

    await authService.changePassword('Old123!', 'New456!');

    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      current_password: 'Old123!',
      new_password: 'New456!',
    });
  });
});

