import { createFileRoute, redirect } from '@tanstack/react-router';
import ProductsPage from '../pages/ProductsPage';

export const Route = createFileRoute('/products')({
  component: ProductsPage,
  beforeLoad: () => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
