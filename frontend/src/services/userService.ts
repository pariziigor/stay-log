import api from './api';
import { User, UserRole } from '../types/auth';

export interface TeamMember {
  employee_id: string;
  owner_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  is_active: boolean;
  created_at: string;
}

export const userService = {
  async listUsers(role?: UserRole): Promise<User[]> {
    const response = await api.get<User[]>('/users', {
      params: role ? { role } : undefined,
    });
    return response.data;
  },

  async listTeamMembers(): Promise<TeamMember[]> {
    const response = await api.get<TeamMember[]>('/users/team');
    return response.data;
  },

  async inviteTeamMember(payload: {
    full_name: string;
    email: string;
    password?: string;
    phone?: string;
    job_title?: string;
  }): Promise<TeamMember> {
    const response = await api.post<TeamMember>('/users/team', payload);
    return response.data;
  },

  async updateUserStatus(userId: string, is_active: boolean): Promise<User> {
    const response = await api.patch<User>(`/users/${userId}/status`, { is_active });
    return response.data;
  },

  async changePassword(payload: { current_password: string; new_password: string }): Promise<void> {
    await api.post('/auth/change-password', payload);
  },

  async recordConsent(payload: { consent_type: string; policy_version: string }): Promise<void> {
    await api.post('/auth/consent', payload);
  },
};
