import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileText,
  TrendingUp,
  History,
  Truck,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  Menu,
  X,
  Activity,
  LogOut,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import useAuth from '../store/useAuth';
import useSettings from '../store/useSettings';
import { useDb } from '../store/useDb';
import { computeAlerts } from '../store/useAlerts';
import useToast from '../store/useToast';

const NAV_LINKS = [
  { path: '/', label: 'Overview', Icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', Icon: Package },
  { path: '/reports', label: 'Reports', Icon: FileText },
  { path: '/forecast', label: 'Forecast', Icon: TrendingUp },
  { path: '/history', label: 'History', Icon: History },
  { path: '/suppliers', label: 'Suppliers', Icon: Truck },
  { path: '/settings', label: 'Settings', Icon: Settings },
];

function AlertIcon({ level }) {
  if (level === 'error') return <AlertTriangle size={13} style={{ color: 'var(--down)', flexShrink: 0 }} />;
  if (level === 'warn') return <AlertTriangle size={13} style={{ color: 'var(--warn)', flexShrink: 0 }} />;
  if (level === 'info') return <Info size={13} style={{ color: 'var(--purple)', flexShrink: 0 }} />;
  return <CheckCircle2 size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />;
}

export default function Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const { theme, currency, setTheme, setCurrency } = useSettings();
  const { inventory, entries, goals, alertsDismissed } = useDb();
  const globalThreshold = useSettings((s) => s.globalLowStockThreshold);
  const addToast = useToast((s) => s.addToast);

  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionTime, setSessionTime] = useState('0m');
  const userRef = useRef(null);
  const bellRef = useRef(null);

  const alerts = computeAlerts(inventory, entries, goals, alertsDismissed, globalThreshold);
  const alertCount = alerts.length;

  const links = session?.role === 'admin'
    ? [...NAV_LINKS.slice(0, -1), { path: '/admin', label: 'Admin', Icon: ShieldCheck }, NAV_LINKS[NAV_LINKS.length - 1]]
    : NAV_LINKS;

  // Session timer
  useEffect(() => {
    if (!session?.loginTime) return;
    const update = () => {
      const elapsed = Date.now() - session.loginTime;
      const h = Math.floor(elapsed / 3600000);
      const m = Math.floor((elapsed % 3600000) / 60000);
      setSessionTime(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [session?.loginTime]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dismissAlert = (id) => {
    useDb.getState().dismissAlert(id);
  };

  const dismissAll = () => {
    alerts.forEach((a) => useDb.getState().dismissAlert(a.id));
    setBellOpen(false);
  };

  const initials = session ? session.username.slice(0, 2).toUpperCase() : '??';

  return (
    <>
      <nav className="nav">
        <div className="nav__brand cursor-pointer" onClick={() => navigate('/')}>
          SaleStew<span className="nav__brand-sub">// tracker</span>
        </div>

        {/* Desktop links */}
        <ul className="nav__links">
          {links.map((l) => (
            <li key={l.path}>
              <a
                href={l.path}
                className={location.pathname === l.path ? 'is-active' : ''}
                onClick={(e) => { e.preventDefault(); navigate(l.path); setDrawerOpen(false); }}
              >
                <l.Icon size={14} />
                <span>{l.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="nav__right">
          {/* Currency */}
          <div style={{ display: 'flex', gap: 0 }}>
            <button
              type="button"
              className={`currency-btn ${currency === 'NGN' ? 'is-active' : ''}`}
              onClick={() => setCurrency('NGN')}
            >
              ₦ NGN
            </button>
            <button
              type="button"
              className={`currency-btn ${currency === 'USD' ? 'is-active' : ''}`}
              onClick={() => setCurrency('USD')}
            >
              $ USD
            </button>
          </div>

          {/* Theme */}
          <button
            type="button"
            className="theme-btn flex items-center gap-1.5"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle color theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={13} className="text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-[var(--purple)]" />
                <span>Dark</span>
              </>
            )}
          </button>

          {/* Bell */}
          <div className="bell-wrap dropdown" ref={bellRef}>
            <button
              type="button"
              className="bell-btn"
              onClick={() => { setBellOpen((v) => !v); setUserOpen(false); }}
              aria-label="Alerts"
            >
              <Bell size={14} />
              {alertCount > 0 && (
                <span className="bell-badge">{alertCount > 9 ? '9+' : alertCount}</span>
              )}
            </button>
            {bellOpen && (
              <div className="alerts-panel">
                <div className="alerts-panel__head">
                  <span>Notifications</span>
                  {alertCount > 0 && (
                    <span className="bell-badge" style={{ position: 'static', marginLeft: 6 }}>{alertCount}</span>
                  )}
                  {alertCount > 0 && (
                    <button type="button" className="alerts-panel__clear-all" onClick={dismissAll}>Clear all</button>
                  )}
                </div>
                {alerts.length === 0 ? (
                  <div className="alerts-panel__empty flex flex-col items-center gap-2">
                    <CheckCircle2 size={20} className="text-green-500 opacity-70" />
                    <span>All clear — no alerts right now.</span>
                  </div>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className={`alerts-item alerts-item--${a.level}`}>
                      <AlertIcon level={a.level} />
                      <div className="alerts-item__body">
                        <div className="alerts-item__title">{a.title}</div>
                        <div className="alerts-item__msg">{a.body}</div>
                        {a.action && (
                          <button
                            type="button"
                            className="alerts-item__action flex items-center gap-1"
                            onClick={() => { navigate('/' + a.action.page.replace('dashboard', '')); setBellOpen(false); }}
                          >
                            <span>{a.action.label}</span> →
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className="alerts-item__dismiss hover:opacity-100 opacity-60"
                        onClick={() => dismissAlert(a.id)}
                        aria-label="Dismiss alert"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="nav__user dropdown" ref={userRef} onClick={() => { setUserOpen((v) => !v); setBellOpen(false); }}>
            <div className="nav__avatar">{initials}</div>
            <span className="nav__user-name">{session?.username}</span>
            <ChevronDown size={11} className="opacity-60" />
            {userOpen && (
              <div className="dropdown__menu">
                <div style={{ padding: '0.6rem 1rem 0.4rem', fontSize: '0.62rem', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {session?.username}{' '}
                  <span className={`badge badge-${session?.role === 'admin' ? 'orange' : 'info'}`}>{session?.role}</span>
                </div>
                <div style={{ padding: '0.15rem 1rem 0.5rem', fontSize: '0.6rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--green)', fontSize: '0.55rem' }}>●</span>
                  Session: <span>{sessionTime}</span>
                </div>
                <div className="dropdown__divider" />
                <button
                  type="button"
                  className="dropdown__item flex items-center gap-2"
                  onClick={() => { navigate('/settings'); setUserOpen(false); }}
                >
                  <Settings size={13} />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  className="dropdown__item flex items-center gap-2"
                  onClick={() => { navigate('/activity'); setUserOpen(false); }}
                >
                  <Activity size={13} />
                  <span>Activity Log</span>
                </button>
                <div className="dropdown__divider" />
                <button
                  type="button"
                  className="dropdown__item dropdown__item--danger flex items-center gap-2"
                  onClick={handleLogout}
                >
                  <LogOut size={13} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>

          {/* Hamburger */}
          <button
            type="button"
            className="nav__hamburger"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Backdrop for mobile drawer */}
      {drawerOpen && (
        <div
          className="nav__drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer - partial width side dash */}
      <div className={`nav__drawer ${drawerOpen ? 'is-open' : ''}`}>
        {links.map((l) => (
          <a
            key={l.path}
            href={l.path}
            className={`flex items-center gap-2.5 ${location.pathname === l.path ? 'is-active' : ''}`}
            onClick={(e) => { e.preventDefault(); navigate(l.path); setDrawerOpen(false); }}
          >
            <l.Icon size={15} />
            <span>{l.label}</span>
          </a>
        ))}
        <div className="nav__drawer-extras">
          <button
            type="button"
            className={`currency-btn ${currency === 'NGN' ? 'is-active' : ''}`}
            onClick={() => { setCurrency('NGN'); setDrawerOpen(false); }}
          >
            ₦ NGN
          </button>
          <button
            type="button"
            className={`currency-btn ${currency === 'USD' ? 'is-active' : ''}`}
            onClick={() => { setCurrency('USD'); setDrawerOpen(false); }}
          >
            $ USD
          </button>
          <button
            type="button"
            className="theme-btn flex items-center gap-1.5"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={13} className="text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-[var(--purple)]" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
