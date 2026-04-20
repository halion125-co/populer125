import React, { createContext, useContext, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { saveFCMToken } from '../utils/secureStorage';
import { registerDeviceToken } from '../api/notifications';

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextValue {
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  children,
  onNotificationTap,
}: {
  children: React.ReactNode;
  onNotificationTap?: (notificationId: string) => void;
}) {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    if (!Device.isDevice) return false;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    // Android 알림 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: '주문 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6000',
      });
    }

    // FCM 토큰 획득 및 서버 등록
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const fcmToken = tokenData.data;
      console.log('[FCM] 토큰 획득:', fcmToken?.substring(0, 20) + '...');
      await saveFCMToken(fcmToken);
      await registerDeviceToken(fcmToken, Platform.OS, Device.deviceName ?? '');
      console.log('[FCM] 서버 등록 완료');
    } catch (e: any) {
      console.warn('[FCM] 토큰 등록 실패:', e?.message ?? e);
    }

    return true;
  };

  useEffect(() => {
    // 백그라운드에서 알림 탭했을 때 처리
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.notification_id && onNotificationTap) {
        onNotificationTap(data.notification_id);
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [onNotificationTap]);

  return (
    <NotificationContext.Provider value={{ requestPermission }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
