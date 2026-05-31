import { createFileRoute, redirect } from '@tanstack/react-router';
import DataCollectPage from '../pages/DataCollectPage';

export const Route = createFileRoute('/data-collect')({
  component: DataCollectPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
