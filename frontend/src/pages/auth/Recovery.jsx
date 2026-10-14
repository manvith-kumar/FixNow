import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/index.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert, Button, TextField } from '../../components/ui/index.js';

export function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(null);
  const submit = useSubmit(async () => { const res = await authApi.forgotPassword(email.trim()); setDone(res.data); });
  return (
    <AuthLayout title="Reset your password" intro="Enter your account email.">
      {done ? (
        <>
          <Alert tone="ok">{done.message}</Alert>
          <p className="muted small">No email service is connected in this release, so reset instructions are not emailed.</p>
          {done.devResetToken && (
            <Alert tone="warn" title="Development only">The server returned a reset token because it is running in development mode. <Link to={`/reset-password?token=${done.devResetToken}`}>Open the reset page</Link>.</Alert>
          )}
          <Link to="/login">Back to log in</Link>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) submit.run(); }} noValidate>
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={submit.fieldErrors.email} required />
          {submit.error && <Alert tone="bad">{submit.error}</Alert>}
          <Button type="submit" variant="primary" block busy={submit.busy}>Send reset instructions</Button>
          <p style={{ marginTop: 'var(--s-4)' }}><Link to="/login">Back to log in</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  useDocumentTitle('Choose a new password');
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ token: sp.get('token') ?? '', password: '', confirm: '' });
  const [local, setLocal] = useState({});
  const submit = useSubmit(async () => { await authApi.resetPassword(form.token.trim(), form.password); nav('/login', { replace: true, state: { registered: true } }); });
  const onSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.token.trim().length < 20) errs.token = 'Paste the reset token from your reset link.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Use at least 8 characters with a letter and a digit.';
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match.';
    setLocal(errs);
    if (!Object.keys(errs).length) submit.run();
  };
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={onSubmit} noValidate>
        {!sp.get('token') && <TextField label="Reset token" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} error={local.token} required />}
        <TextField label="New password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={local.password} hint="At least 8 characters, with a letter and a digit." required />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={local.confirm} required />
        {submit.error && <Alert tone="bad">{submit.error}</Alert>}
        <Button type="submit" variant="primary" block busy={submit.busy}>Update password</Button>
      </form>
    </AuthLayout>
  );
}
