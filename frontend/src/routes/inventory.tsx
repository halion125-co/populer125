import { createFileRoute, redirect } from '@tanstack/react-router';
import InventoryPage from '../pages/InventoryPage';

export const Route = createFileRoute('/inventory')({
  component: InventoryPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
