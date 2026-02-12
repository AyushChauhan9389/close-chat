import { useState, useRef, useEffect } from 'react';
import * as api from '../lib/api';
import { useApp } from '../context/AppContext';

export default function AuthOverlay() {
  const { setCurrentUser, initApp } = useApp();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Signup fields
  const [signupUser, setSignupUser] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  // Refs for focusing
  const loginUserRef = useRef<HTMLInputElement>(null);
  const loginPassRef = useRef<HTMLInputElement>(null);
  const signupUserRef = useRef<HTMLInputElement>(null);
  const signupEmailRef = useRef<HTMLInputElement>(null);
  const signupPassRef = useRef<HTMLInputElement>(null);
  const signupConfirmRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    loginUserRef.current?.focus();
  }, []);

  // Auto-login: verify stored token on startup
  const autoLoginAttempted = useRef(false);
  useEffect(() => {
    if (autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    const token = api.getToken();
    if (token) {
      api.verifyToken()
        .then((user) => {
          setCurrentUser(user);
          initApp();
        })
        .catch(() => {
          api.clearToken();
        });
    }
  }, [setCurrentUser, initApp]);

  function showError(msg: string) {
    setError(`*** ${msg}`);
    setTimeout(() => setError(''), 4000);
  }

  function dismissAuth(user: api.User) {
    setCurrentUser(user);
    initApp();
  }

  // ── Login ──
  async function handleLogin() {
    const user = loginUser.trim();
    const pass = loginPass;

    if (!user) { showError('username required'); loginUserRef.current?.focus(); return; }
    if (!pass) { showError('password required'); loginPassRef.current?.focus(); return; }
    if (user.length < 3) { showError('username too short (min 3)'); loginUserRef.current?.focus(); return; }

    setLoading(true);
    try {
      const data = await api.login(user, pass);
      dismissAuth(data.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'login failed';
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Signup ──
  async function handleSignup() {
    const user = signupUser.trim();
    const email = signupEmail.trim();
    const pass = signupPass;
    const confirm = signupConfirm;

    if (!user) { showError('username required'); signupUserRef.current?.focus(); return; }
    if (user.length < 3) { showError('username too short (min 3)'); signupUserRef.current?.focus(); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(user)) { showError('username: letters, numbers, _ only'); signupUserRef.current?.focus(); return; }
    if (!email || !email.includes('@')) { showError('valid email required'); signupEmailRef.current?.focus(); return; }
    if (!pass) { showError('password required'); signupPassRef.current?.focus(); return; }
    if (pass.length < 6) { showError('password too short (min 6)'); signupPassRef.current?.focus(); return; }
    if (pass !== confirm) { showError('passwords do not match'); signupConfirmRef.current?.focus(); return; }

    setLoading(true);
    try {
      const data = await api.signup(user, email, pass);
      dismissAuth(data.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'registration failed';
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="authOverlay">
      <div className="auth-card">
        {/* Login Form */}
        {mode === 'login' && (
          <div className="auth-form">
            <div className="auth-header">
              <span className="auth-logo">closechat</span>
              <span className="auth-subtitle">// login</span>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="loginUser">&gt; username</label>
              <div className="auth-input-wrap">
                <div className="auth-cursor"></div>
                <input
                  type="text"
                  id="loginUser"
                  ref={loginUserRef}
                  className="auth-input"
                  placeholder="enter username..."
                  autoComplete="off"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loginPassRef.current?.focus(); }}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="loginPass">&gt; password</label>
              <div className="auth-input-wrap">
                <div className="auth-cursor"></div>
                <input
                  type="password"
                  id="loginPass"
                  ref={loginPassRef}
                  className="auth-input"
                  placeholder="enter password..."
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                />
              </div>
            </div>

            <div className="auth-error">{error}</div>

            <button
              className={`auth-btn${loading ? ' loading' : ''}`}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'connecting...' : 'connect'}
            </button>

            <div className="auth-switch">
              <span className="auth-switch-text">no account?</span>
              <button
                className="auth-switch-btn"
                onClick={() => { setMode('signup'); setError(''); }}
              >
                register
              </button>
            </div>
          </div>
        )}

        {/* Signup Form */}
        {mode === 'signup' && (
          <div className="auth-form">
            <div className="auth-header">
              <span className="auth-logo">closechat</span>
              <span className="auth-subtitle">// register</span>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signupUser">&gt; username</label>
              <div className="auth-input-wrap">
                <div className="auth-cursor"></div>
                <input
                  type="text"
                  id="signupUser"
                  ref={signupUserRef}
                  className="auth-input"
                  placeholder="choose username..."
                  autoComplete="off"
                  value={signupUser}
                  onChange={(e) => setSignupUser(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') signupEmailRef.current?.focus(); }}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signupEmail">&gt; email</label>
              <div className="auth-input-wrap">
                <div className="auth-cursor"></div>
                <input
                  type="email"
                  id="signupEmail"
                  ref={signupEmailRef}
                  className="auth-input"
                  placeholder="enter email..."
                  autoComplete="off"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') signupPassRef.current?.focus(); }}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signupPass">&gt; password</label>
              <div className="auth-input-wrap">
                <div className="auth-cursor"></div>
                <input
                  type="password"
                  id="signupPass"
                  ref={signupPassRef}
                  className="auth-input"
                  placeholder="choose password..."
                  value={signupPass}
                  onChange={(e) => setSignupPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') signupConfirmRef.current?.focus(); }}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signupConfirm">&gt; confirm</label>
              <div className="auth-input-wrap">
                <div className="auth-cursor"></div>
                <input
                  type="password"
                  id="signupConfirm"
                  ref={signupConfirmRef}
                  className="auth-input"
                  placeholder="confirm password..."
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSignup(); }}
                />
              </div>
            </div>

            <div className="auth-error">{error}</div>

            <button
              className={`auth-btn${loading ? ' loading' : ''}`}
              onClick={handleSignup}
              disabled={loading}
            >
              {loading ? 'registering...' : 'register'}
            </button>

            <div className="auth-switch">
              <span className="auth-switch-text">have an account?</span>
              <button
                className="auth-switch-btn"
                onClick={() => { setMode('login'); setError(''); }}
              >
                login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
