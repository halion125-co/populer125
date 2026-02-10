import { createFileRoute, redirect } from '@tanstack/react-router';
import DashboardPage from '../pages/DashboardPage';

export const Route = createFileRoute('/')({
  component: DashboardPage,
  beforeLoad: ({ context }) => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
