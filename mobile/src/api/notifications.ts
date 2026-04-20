import { apiClient } from './client';

export interface NotificationHistoryItem {
  id: number;
  title: string;
  total_qty: number;
  total_amount: number;
  detail_json: string[];
  sent_at: string;
}

export interface NotificationSettings {
  push_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
}

export async function registerDeviceToken(fcmToken: string, platform: string, deviceName: string) {
  await apiClient.post('/api/device-tokens', {
    fcm_token: fcmToken,
    platform,
    device_name: deviceName,
  });
}

export async function removeDeviceToken(fcmToken: string) {
  await apiClient.delete('/api/device-tokens', { data: { fcm_token: fcmToken } });
}

export async function getNotificationHistory(page = 1, limit = 20) {
  const res = await apiClient.get('/api/notifications/history', { params: { page, limit } });
  return res.data as { items: NotificationHistoryItem[]; total: number; page: number; limit: number };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await apiClient.get('/api/notifications/settings');
  return res.data;
}

export async function updateNotificationSettings(settings: NotificationSettings) {
  await apiClient.put('/api/notifications/settings', settings);
}
