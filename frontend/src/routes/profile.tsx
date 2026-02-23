import { createFileRoute, redirect } from '@tanstack/react-router';
import ProfilePage from '../pages/ProfilePage';

export const Route = createFileRoute('/profile')({
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: ProfilePage,
});
