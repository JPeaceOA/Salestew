import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Eye, EyeOff, Check, X } from 'lucide-react';
import useAuth from '../store/useAuth';
import useToast from '../store/useToast';
import { passwordStrength } from '../lib/crypto';

// Real-time requirements checklist
const REQUIREMENTS = [
  { id: 'len',    test: (pw) => pw.length >= 8,          label: 'At least 8 characters' },
  { id: 'upper',  test: (pw) => /[A-Z]/.test(pw),        label: 'One uppercase letter' },
  { id: 'lower',  test: (pw) => /[a-z]/.test(pw),        label: 'One lowercase letter' },
  { id: 'digit',  test: (pw) => /\d/.test(pw),           label: 'One number' },
  { id: 'special',test: (pw) => /[^A-Za-z0-9]/.test(pw), label: 'One special character' },
];

function RequirementRow({ met, label }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.72rem',
        color: met ? 'var(--green)' : 'var(--text-3)',
        transition: 'color 0.2s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {met ? <Check size={12} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1px solid currentColor', display: 'inline-block' }} />}
      </span>
      {label}
    </li>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const register = useAuth((s) => s.register);
  const session  = useAuth((s) => s.session);
  const addToast = useToast((s) => s.addToast);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  const userRef = useRef(null);
  useEffect(() => { userRef.current?.focus(); }, []);

  const strength = passwordStrength(password);
  const allMet   = REQUIREMENTS.every((r) => r.test(password));
  const matchOk  = confirm.length > 0 && password === confirm;
  const matchBad = confirm.length > 0 && password !== confirm;

  // Username validation
  const usernameOk = username.trim().length >= 3 && /^[A-Za-z0-9_.-]+$/.test(username.trim());

  const doSignup = async (e) => {
    e?.preventDefault();
    if (!usernameOk) {
      setError('Username must be ≥ 3 chars and only contain letters, numbers, _, . or -');
      return;
    }
    if (!allMet) {
      setError('Password does not meet all requirements below.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await register({ username: username.trim(), password, role: 'user' });
    if (res.ok) {
      addToast({ msg: `Welcome, ${username.trim()}! Account created.`, type: 'success' });
      navigate('/', { replace: true });
    } else {
      setError(res.error);
      setLoading(false);
    }
  };

  const barSegments = 5;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '380px' }}>
        <div className="auth-card__logo">SaleStew</div>
        <div className="auth-card__sub">// create your account</div>
        <h2 className="auth-card__title">New account</h2>

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

        <form onSubmit={doSignup} autoComplete="on" noValidate>
          {/* Username */}
          <div className="form-group">
            <label className="form-label" htmlFor="su-username">
              Username
              {username.trim().length >= 3 && (
                <span
                  style={{
                    marginLeft: '0.4rem',
                    fontSize: '0.7rem',
                    color: usernameOk ? 'var(--green)' : 'var(--down)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {usernameOk ? <><Check size={11} /> valid</> : <><X size={11} /> invalid chars</>}
                </span>
              )}
            </label>
            <input
              id="su-username"
              ref={userRef}
              className="form-input"
              type="text"
              placeholder="choose a username (≥ 3 chars)"
              autoComplete="username"
              spellCheck={false}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              disabled={loading}
              aria-required="true"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="su-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="su-password"
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="min. 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
                aria-required="true"
                aria-describedby="pw-strength-label"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: 'absolute', right: '0.6rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-3)', padding: '0.2rem',
                  display: 'flex', alignItems: 'center',
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '3px', height: '4px', borderRadius: '4px', overflow: 'hidden' }}>
                  {Array.from({ length: barSegments }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        background: i < strength.score ? strength.color : 'var(--border)',
                        transition: 'background 0.25s',
                        borderRadius: '2px',
                      }}
                    />
                  ))}
                </div>
                <span
                  id="pw-strength-label"
                  style={{
                    fontSize: '0.68rem',
                    color: strength.color,
                    marginTop: '0.2rem',
                    display: 'block',
                    fontWeight: 600,
                  }}
                  aria-live="polite"
                >
                  {strength.label}
                </span>
              </div>
            )}

            {/* Requirements checklist */}
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
              {REQUIREMENTS.map((r) => (
                <RequirementRow key={r.id} met={r.test(password)} label={r.label} />
              ))}
            </ul>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="su-confirm">
              Confirm Password
              {confirm.length > 0 && (
                <span
                  style={{
                    marginLeft: '0.4rem',
                    fontSize: '0.7rem',
                    color: matchOk ? 'var(--green)' : 'var(--down)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {matchOk ? <><Check size={11} /> match</> : <><X size={11} /> no match</>}
                </span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="su-confirm"
                className="form-input"
                type={showCf ? 'text' : 'password'}
                placeholder="repeat your password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                disabled={loading}
                style={{
                  paddingRight: '2.5rem',
                  borderColor: confirm.length > 0
                    ? (matchOk ? 'var(--green)' : 'var(--down)')
                    : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowCf((v) => !v)}
                style={{
                  position: 'absolute', right: '0.6rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-3)', padding: '0.2rem',
                  display: 'flex', alignItems: 'center',
                }}
                aria-label={showCf ? 'Hide password' : 'Show password'}
              >
                {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            type="submit"
            style={{ marginTop: '0.75rem' }}
            disabled={loading || !allMet || !usernameOk || !matchOk}
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
                Creating…
              </span>
            ) : 'Create Account'}
          </button>
        </form>

        <div className="auth-card__switch">
          Have an account?{' '}
          <a
            onClick={() => navigate('/login')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/login')}
            style={{ cursor: 'pointer' }}
          >
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
