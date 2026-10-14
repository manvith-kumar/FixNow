import { useState } from 'react';
import { authApi, usersApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Button, Card, PageHeader, TextField } from '../../components/ui/index.js';
import { ROLE_LABEL } from '../../utils/status.js';

export default function ProfilePage() {
  useDocumentTitle('Profile');
  const { user, refreshUser, replaceToken } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ fullName: user.fullName, phone: user.phone ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState({});
  const save = useSubmit(async () => {
    const body = { fullName: f.fullName.trim() }; if (f.phone.trim()) body.phone = f.phone.trim();
    await usersApi.updateMe(body); await refreshUser(); toast.success('Profile updated.');
  });
  const change = useSubmit(async () => {
    const res = await authApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
    replaceToken(res.data.token); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast.success('Password changed.');
  });
  const tryChange = (e) => {
    e.preventDefault();
    const er = {};
    if (!pw.currentPassword) er.currentPassword = 'Enter your current password.';
    if (pw.newPassword.length < 8 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) er.newPassword = 'Use at least 8 characters with a letter and a digit.';
    if (pw.confirm !== pw.newPassword) er.confirm = 'Passwords do not match.';
    setPwErr(er); if (!Object.keys(er).length) change.run();
  };
  return (
    <>
      <PageHeader title="Your profile" subtitle={`${ROLE_LABEL[user.role]} account`} />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card title="Personal details">
          <form onSubmit={(e) => { e.preventDefault(); if (f.fullName.trim().length >= 2) save.run(); }} noValidate>
            <TextField label="Email" value={user.email} disabled hint="Your email is your login and cannot be changed here." />
            <TextField label="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} error={save.fieldErrors.fullName} required />
            <TextField label="Phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={save.fieldErrors.phone} />
            {save.error && <Alert tone="bad">{save.error}</Alert>}
            <Button type="submit" variant="primary" busy={save.busy}>Save changes</Button>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={tryChange} noValidate>
            <TextField label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={pwErr.currentPassword} />
            <TextField label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={pwErr.newPassword || change.fieldErrors.newPassword} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErr.confirm} />
            {change.error && <Alert tone="bad">{change.error}</Alert>}
            <Button type="submit" busy={change.busy}>Change password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
