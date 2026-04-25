import { createFileRoute, redirect } from '@tanstack/react-router';
import AdminPage from '../pages/AdminPage';

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) throw redirect({ to: '/login' });
    try {
      const user = JSON.parse(storedUser);
      if (!user.isAdmin) throw redirect({ to: '/' });
    } catch {
      throw redirect({ to: '/' });
    }
  },
  component: AdminPage,
});
