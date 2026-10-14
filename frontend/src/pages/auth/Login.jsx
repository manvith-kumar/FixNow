import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert, Button, TextField } from '../../components/ui/index.js';

export default function Login() {
  useDocumentTitle('Log in');
  const { login, notice } = useAuth();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [local, setLocal] = useState({});
  // On success the auth state changes and <GuestRoute> performs the redirect (to the page the user asked for, or their dashboard).
  const submit = useSubmit(async () => { await login(form.email.trim(), form.password); });
  const onSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (!form.password) errs.password = 'Enter your password.';
    setLocal(errs);
    if (!Object.keys(errs).length) submit.run();
  };
  return (
    <AuthLayout title="Log in" intro="Welcome back.">
      {notice && <Alert tone="warn">{notice}</Alert>}
      {loc.state?.registered && <Alert tone="ok">Your password was updated. Log in with the new one.</Alert>}
      <form onSubmit={onSubmit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={local.email || submit.fieldErrors.email} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={local.password || submit.fieldErrors.password} required />
        {submit.error && <Alert tone="bad">{submit.error}</Alert>}
        <Button type="submit" variant="primary" block busy={submit.busy} busyLabel="Logging in...">Log in</Button>
      </form>
      <p style={{ marginTop: 'var(--s-4)' }}><Link to="/forgot-password">Forgot your password?</Link></p>
      <p>New to FixNow? <Link to="/register">Create an account</Link></p>
    </AuthLayout>
  );
}
