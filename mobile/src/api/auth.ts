import { apiClient } from './client';

export interface LoginResponse {
  token: string;
  expires_at: number;
  user: {
    id: number;
    email: string;
    phone: string;
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post('/api/auth/login', { email, password });
  return res.data;
}

export async function refreshToken(token: string): Promise<{ token: string; expires_at: number }> {
  const res = await apiClient.post(
    '/api/auth/refresh',
    null,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}
