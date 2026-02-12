import { createFileRoute, redirect } from '@tanstack/react-router';
import OrdersPage from '../pages/OrdersPage';

export const Route = createFileRoute('/orders')({
  component: OrdersPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
