import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const EXPIRES_KEY = 'auth_expires_at';
const FCM_KEY = 'fcm_token';

export async function saveToken(token: string, expiresAt: number) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(EXPIRES_KEY, String(expiresAt));
}

export async function getToken(): Promise<{ token: string; expiresAt: number } | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const expiresAt = await SecureStore.getItemAsync(EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  return { token, expiresAt: Number(expiresAt) };
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_KEY);
}

export async function saveFCMToken(token: string) {
  await SecureStore.setItemAsync(FCM_KEY, token);
}

export async function getFCMToken(): Promise<string | null> {
  return SecureStore.getItemAsync(FCM_KEY);
}

export async function clearFCMToken() {
  await SecureStore.deleteItemAsync(FCM_KEY);
}
