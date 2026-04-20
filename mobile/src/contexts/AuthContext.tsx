import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { login as apiLogin } from '../api/auth';
import { BASE_URL } from '../api/client';
import { getToken, saveToken, clearToken } from '../utils/secureStorage';

const AUTO_LOGIN_KEY = 'auto_login';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, autoLogin?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const appState = useRef(AppState.currentState);
  const checking = useRef(false); // 중복 실행 방지

  const checkAndRefresh = async () => {
    if (checking.current) return;
    checking.current = true;

    try {
      // 자동로그인이 꺼져 있으면 로그인 화면으로
      const autoLoginEnabled = await SecureStore.getItemAsync(AUTO_LOGIN_KEY);
      if (autoLoginEnabled !== 'true') {
        setState({ token: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const stored = await getToken();
      if (!stored) {
        setState({ token: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const remainingSecs = stored.expiresAt - now;

      // 1시간 이상 남으면 그대로 사용
      if (remainingSecs > 3600) {
        setState({ token: stored.token, isLoading: false, isAuthenticated: true });
        return;
      }

      // 만료됐거나 1시간 이내 — refresh 시도
      // apiClient 인터셉터를 거치지 않고 axios 직접 호출 (무한루프 방지)
      try {
        const res = await axios.post(`${BASE_URL}/api/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${stored.token}` },
          timeout: 10000,
        });
        const { token, expires_at } = res.data;
        await saveToken(token, expires_at);
        setState({ token, isLoading: false, isAuthenticated: true });
      } catch (refreshErr: any) {
        // refresh 서버 오류(5xx) 또는 네트워크 오류면 기존 토큰 유지 (로그인 유지)
        // 401(7일 초과 만료)이면 토큰 삭제 후 로그인 화면
        if (refreshErr?.response?.status === 401) {
          await clearToken();
          setState({ token: null, isLoading: false, isAuthenticated: false });
        } else {
          // 서버/네트워크 문제 — 일단 인증 유지
          setState({ token: stored.token, isLoading: false, isAuthenticated: true });
        }
      }
    } finally {
      checking.current = false;
    }
  };

  useEffect(() => {
    checkAndRefresh();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkAndRefresh();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);

  const login = async (email: string, password: string, autoLogin = false) => {
    const res = await apiLogin(email, password);
    // 토큰 저장 먼저, 자동로그인 설정은 한 곳(여기)에서만 저장
    await saveToken(res.token, res.expires_at);
    await SecureStore.setItemAsync(AUTO_LOGIN_KEY, autoLogin ? 'true' : 'false');
    setState({ token: res.token, isLoading: false, isAuthenticated: true });
  };

  const logout = async () => {
    await SecureStore.setItemAsync(AUTO_LOGIN_KEY, 'false');
    await clearToken();
    setState({ token: null, isLoading: false, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
