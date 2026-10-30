import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import useAuth from '../store/useAuth';
import useToast from '../store/useToast';

export default function LoginPage() {
  const navigate   = useNavigate();
  const login      = useAuth((s) => s.login);
  const session    = useAuth((s) => s.session);
  const addToast   = useToast((s) => s.addToast);

  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPw,   setShowPw]     = useState(false);
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  const userRef = useRef(null);
  useEffect(() => { userRef.current?.focus(); }, []);

  const doLogin = async (e) => {
    e?.preventDefault();
    const trimUser = username.trim();
    if (!trimUser || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await login({ username: trimUser, password });
    if (res.ok) {
      addToast({ msg: `Welcome back, ${trimUser}!`, type: 'success' });
      navigate('/', { replace: true });
    } else {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">SaleStew</div>
        <div className="auth-card__sub">// product sales &amp; inventory tracker</div>
        <h2 className="auth-card__title">Sign in</h2>

        {error && (
          <div
            className="alert alert--error flex items-center gap-2"
            role="alert"
            aria-live="assertive"
            style={{ marginBottom: '1rem' }}
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={doLogin} autoComplete="on" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              ref={userRef}
              className="form-input"
              type="text"
              placeholder="your username"
              autoComplete="username"
              spellCheck={false}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              disabled={loading}
              aria-required="true"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
                aria-required="true"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position:   'absolute',
                  right:      '0.6rem',
                  top:        '50%',
                  transform:  'translateY(-50%)',
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  color:      'var(--text-3)',
                  padding:    '0.2rem',
                  display:    'flex',
                  alignItems: 'center',
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            type="submit"
            style={{ marginTop: '0.75rem' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <span
                  style={{
                    width: '1em', height: '1em',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="auth-card__switch">
          No account?{' '}
          <a
            onClick={() => navigate('/signup')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/signup')}
            style={{ cursor: 'pointer' }}
          >
            Create one
          </a>
        </div>

        {/* Hint shown only when default admin still exists */}
        <p style={{
          fontSize: '0.58rem',
          color: 'var(--text-3)',
          marginTop: '0.75rem',
          textAlign: 'center',
        }}>
          Default credentials: <code>admin</code> / <code>admin123</code>
        </p>
      </div>
    </div>
  );
}
