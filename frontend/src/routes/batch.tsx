import { createFileRoute, redirect } from '@tanstack/react-router';
import BatchPage from '../pages/BatchPage';

export const Route = createFileRoute('/batch')({
  component: BatchPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
