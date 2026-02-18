import { createFileRoute, redirect } from '@tanstack/react-router';
import ReturnsPage from '../pages/ReturnsPage';

export const Route = createFileRoute('/returns')({
  component: ReturnsPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
