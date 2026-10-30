import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Component, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalProvider, ModalHost } from './components/Modal';
import { ToastHost } from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import HistoryPage from './pages/HistoryPage';
import ReportsPage from './pages/ReportsPage';
import ForecastPage from './pages/ForecastPage';
import SuppliersPage from './pages/SuppliersPage';
import ActivityLogPage from './pages/ActivityLogPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import useAuth from './store/useAuth';
import useSettings from './store/useSettings';
import { useDb } from './store/useDb';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-page p-6 text-center">
          <div className="auth-card max-w-md mx-auto p-6 space-y-4">
            <div className="text-2xl font-serif font-bold text-[var(--down)] flex items-center justify-center gap-2">
              <AlertTriangle size={24} />
              <span>Application Error</span>
            </div>
            <p className="text-xs text-[var(--text-2)] font-mono">
              {this.state.error?.message || 'An unexpected error occurred during rendering.'}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.location.reload()}
              >
                Reload App
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  localStorage.removeItem('ss_entries');
                  localStorage.removeItem('ss_inventory');
                  localStorage.removeItem('ss_goals');
                  window.location.reload();
                }}
              >
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInit({ children }) {
  const init = useAuth((s) => s.init);
  const initTheme = useSettings((s) => s.initTheme);
  const seedData = useDb((s) => s.seedData);

  useEffect(() => {
    init();
    initTheme();
    seedData();
  }, []);

  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ModalProvider>
        <BrowserRouter>
          <AppInit>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/forecast" element={<ForecastPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/activity" element={<ActivityLogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppInit>
        </BrowserRouter>
        <ModalHost />
        <ToastHost />
      </ModalProvider>
    </ErrorBoundary>
  );
}
