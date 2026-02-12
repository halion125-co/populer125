import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from '../lib/api';
import type { User, LoginCredentials, LoginResponse, AuthContextType } from '../types/auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize: Load token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      vendor_id: credentials.vendorId,
      access_key: credentials.accessKey,
      secret_key: credentials.secretKey,
    });

    const { token, vendor_id } = response.data;

    localStorage.setItem('auth_token', token);
    const userData = { ...credentials, vendorId: vendor_id };
    localStorage.setItem('user', JSON.stringify(userData));

    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
