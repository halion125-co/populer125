import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordPage from '../pages/ResetPasswordPage';

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { email?: string } => ({
    email: (search.email as string) || undefined,
  }),
  component: ResetPasswordPage,
});
