import { createFileRoute, redirect } from '@tanstack/react-router';
import ProfilePage from '../pages/ProfilePage';

export const Route = createFileRoute('/profile')({
  beforeLoad: ({ context }: { context: { auth?: { isAuthenticated?: boolean } } }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: ProfilePage,
});
