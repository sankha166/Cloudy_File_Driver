import { useState } from 'react';
import type { FormEvent } from 'react';
import { Cloud, Eye, EyeOff, Loader2, ShieldCheck, Sparkles, Zap } from 'lucide-react';

export function AuthScreen({ onSignIn, onSignUp, busy }: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string) => Promise<void>;
  busy: boolean;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'signin') await onSignIn(email, password);
      else await onSignUp(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-left">
        <div className="auth-brand"><span className="brand-mark"><Cloud size={20} strokeWidth={2.7} /></span><span>Cloudly</span></div>
        <div className="auth-hero">
          <h1>Your files, organized in a calmer cloud.</h1>
          <p>Store, share, and find everything you create — with a workspace designed for clarity, not clutter.</p>
          <div className="auth-features">
            <div className="auth-feature"><span className="feature-dot blue"><Zap size={15} /></span><div><strong>Instant access</strong><span>Open any file from any device</span></div></div>
            <div className="auth-feature"><span className="feature-dot mint"><ShieldCheck size={15} /></span><div><strong>Private by default</strong><span>Your files are encrypted and yours alone</span></div></div>
            <div className="auth-feature"><span className="feature-dot peach"><Sparkles size={15} /></span><div><strong>Share with control</strong><span>Links expire, access is revocable</span></div></div>
          </div>
        </div>
        <p className="auth-footer">© 2026 Cloudly · Built for production</p>
      </div>
      <div className="auth-right">
        <form onSubmit={submit} className="auth-card">
          <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-sub">{mode === 'signin' ? 'Sign in to access your workspace.' : 'Start organizing your work in seconds.'}</p>
          {mode === 'signup' && (
            <label className="auth-field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Carter" required autoComplete="name" /></label>
          )}
          <label className="auth-field"><span>Email address</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
          <label className="auth-field"><span>Password</span><div className="pw-wrap"><input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPw((s) => !s)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button full-button" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : null}{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="switch-auth" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
