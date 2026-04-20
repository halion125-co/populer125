import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { NotificationProvider, useNotification } from './src/contexts/NotificationContext';
import RootNavigator from './src/navigation/RootNavigator';

function AppInner() {
  const { isAuthenticated } = useAuth();
  const { requestPermission } = useNotification();
  const permissionRequested = useRef(false);

  useEffect(() => {
    // 로그인 직후 한 번만 알림 권한 요청
    if (isAuthenticated && !permissionRequested.current) {
      permissionRequested.current = true;
      requestPermission();
    }
  }, [isAuthenticated]);

  return (
    <>
      <StatusBar style="auto" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppInner />
      </NotificationProvider>
    </AuthProvider>
  );
}
