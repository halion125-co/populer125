import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from '../lib/api';
import type { UserProfile, LoginCredentials, RegisterCredentials, LoginResponse, AuthContextType } from '../types/auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [originalAdminToken, setOriginalAdminToken] = useState<string | null>(null);
  const [originalAdminUser, setOriginalAdminUser] = useState<UserProfile | null>(null);

  // Initialize: Load token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      email: credentials.email,
      password: credentials.password,
    });

    const { token, user } = response.data;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const register = async (credentials: RegisterCredentials) => {
    const response = await apiClient.post<LoginResponse>('/api/auth/register', {
      email: credentials.email,
      password: credentials.password,
      phone: credentials.phone || '',
      vendorId: credentials.vendorId || '',
      accessKey: credentials.accessKey || '',
      secretKey: credentials.secretKey || '',
    });

    const { token, user } = response.data;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const refreshUser = async () => {
    try {
      const response = await apiClient.get<UserProfile>('/api/profile');
      const updatedUser = response.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch {
      // ignore
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setImpersonating(false);
    setOriginalAdminToken(null);
    setOriginalAdminUser(null);
  };

  const startImpersonation = async (targetUserId: number) => {
    const response = await apiClient.post<{ token: string; user: UserProfile }>(
      `/api/admin/impersonate/${targetUserId}`
    );
    const { token: impToken, user: impUser } = response.data;
    setOriginalAdminToken(token);
    setOriginalAdminUser(user);
    localStorage.setItem('auth_token', impToken);
    localStorage.setItem('user', JSON.stringify(impUser));
    setToken(impToken);
    setUser(impUser);
    setImpersonating(true);
  };

  const stopImpersonation = () => {
    if (!originalAdminToken || !originalAdminUser) return;
    localStorage.setItem('auth_token', originalAdminToken);
    localStorage.setItem('user', JSON.stringify(originalAdminUser));
    setToken(originalAdminToken);
    setUser(originalAdminUser);
    setImpersonating(false);
    setOriginalAdminToken(null);
    setOriginalAdminUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      refreshUser,
      isAuthenticated: !!token,
      isLoading,
      impersonating,
      startImpersonation,
      stopImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
