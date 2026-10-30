import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import useAuth from '../store/useAuth';
import Nav from './Nav';
import LowStockBanner from './LowStockBanner';

export default function Layout() {
  const session = useAuth((s) => s.session);
  const location = useLocation();

  // Heartbeat updates lastActive on route navigation only — without causing recursive re-renders
  useEffect(() => {
    useAuth.getState().heartbeat?.();
  }, [location.pathname]);

  if (!session) return <Navigate to="/login" replace />;
  return (
    <>
      <Nav />
      <LowStockBanner />
      <Outlet />
    </>
  );
}
