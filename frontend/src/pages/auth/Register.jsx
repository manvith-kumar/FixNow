import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert, Button, CheckField, SelectField, TextField } from '../../components/ui/index.js';

export default function Register() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const [sp] = useSearchParams();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '', role: sp.get('role') === 'TECHNICIAN' ? 'TECHNICIAN' : 'CUSTOMER', agree: false });
  const [local, setLocal] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  // On success <GuestRoute> redirects (new technicians to the application form, others to their dashboard).
  const submit = useSubmit(async () => {
    const body = { fullName: form.fullName.trim(), email: form.email.trim(), password: form.password, role: form.role, ...(form.phone.trim() ? { phone: form.phone.trim() } : {}) };
    await register(body);
  });
  const onSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.fullName.trim().length < 2) errs.fullName = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Use at least 8 characters with a letter and a digit.';
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match.';
    if (!form.agree) errs.agree = 'Please accept the terms to continue.';
    setLocal(errs);
    if (!Object.keys(errs).length) submit.run();
  };
  const fe = (k) => local[k] || submit.fieldErrors[k];
  return (
    <AuthLayout title="Create your account" intro="It takes a minute." aside={{ title: 'Fix it with a price you have approved.', points: ['Customers: book and approve itemized quotes', 'Technicians: apply, get reviewed, then accept jobs', 'Every step is tracked'] }}>
      <form onSubmit={onSubmit} noValidate>
        <SelectField label="I want to" value={form.role} onChange={set('role')} options={[{ value: 'CUSTOMER', label: 'Book home services' }, { value: 'TECHNICIAN', label: 'Work as a technician' }]} hint={form.role === 'TECHNICIAN' ? 'You will submit an application that an administrator reviews before you can accept jobs.' : undefined} />
        <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={fe('fullName')} required />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={fe('email')} required />
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={fe('phone')} />
        <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={fe('password')} hint="At least 8 characters, with a letter and a digit." required />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={fe('confirm')} required />
        <CheckField checked={form.agree} onChange={set('agree')} error={local.agree}>I agree to the <Link to="/terms" target="_blank">Terms</Link> and <Link to="/privacy" target="_blank">Privacy policy</Link>.</CheckField>
        {submit.error && <Alert tone="bad">{submit.error}</Alert>}
        <Button type="submit" variant="primary" block busy={submit.busy} busyLabel="Creating account...">Create account</Button>
      </form>
      <p style={{ marginTop: 'var(--s-4)' }}>Already registered? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}
