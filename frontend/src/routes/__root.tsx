import { Outlet, createRootRoute } from '@tanstack/react-router';
import ImpersonationBanner from '../components/ImpersonationBanner';

export const Route = createRootRoute({
  component: () => (
    <>
      <ImpersonationBanner />
      <Outlet />
    </>
  ),
});
