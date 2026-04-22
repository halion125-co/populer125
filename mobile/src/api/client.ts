import axios from 'axios';
import { getToken, saveToken } from '../utils/secureStorage';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.halion125.synology.me';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// 요청마다 저장된 토큰을 Authorization 헤더에 주입
apiClient.interceptors.request.use(async (config) => {
  // /auth/ 경로(login, refresh)는 토큰 불필요
  if (config.url?.includes('/auth/')) return config;
  const stored = await getToken();
  if (stored?.token) {
    config.headers.Authorization = `Bearer ${stored.token}`;
  }
  return config;
});

// 401 시 silent refresh 시도 — 실패해도 토큰은 삭제하지 않음
// (토큰 삭제는 AuthContext.checkAndRefresh에서만 담당)
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const is401 = error.response?.status === 401;
    const isAuthRoute = original?.url?.includes('/auth/');

    if (is401 && !isAuthRoute && !original._retry) {
      original._retry = true;
      try {
        const stored = await getToken();
        if (stored?.token) {
          const res = await axios.post(`${BASE_URL}/api/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${stored.token}` },
          });
          const { token, expires_at } = res.data;
          await saveToken(token, expires_at);
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        }
      } catch {
        // refresh 실패 시 토큰 삭제하지 않음 — 호출자가 오류 처리
      }
    }
    return Promise.reject(error);
  }
);
