import { createFileRoute, redirect } from '@tanstack/react-router';
import FCMMonitorPage from '../pages/FCMMonitorPage';

export const Route = createFileRoute('/fcm-monitor')({
  component: FCMMonitorPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
