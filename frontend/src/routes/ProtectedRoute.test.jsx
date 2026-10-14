import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';

let auth = { status: 'anonymous', user: null, signedOut: false };
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/" element={<p>home page</p>} /><Route path="/login" element={<p>login page</p>} /><Route path="/unauthorized" element={<p>not allowed</p>} />
      <Route element={<ProtectedRoute roles={['ADMIN']} />}><Route path="/admin" element={<p>admin area</p>} /></Route>
    </Routes>
  </MemoryRouter>);

describe('ProtectedRoute', () => {
  it('sends anonymous visitors to login', () => { auth = { status: 'anonymous', user: null }; renderAt('/admin'); expect(screen.getByText('login page')).toBeInTheDocument(); });
  it('sends someone who deliberately logged out home, not to the login page', () => { auth = { status: 'anonymous', user: null, signedOut: true }; renderAt('/admin'); expect(screen.getByText('home page')).toBeInTheDocument(); });
  it('shows a loading state while the session is restored', () => { auth = { status: 'loading', user: null }; renderAt('/admin'); expect(screen.getByText(/Restoring your session/)).toBeInTheDocument(); });
  it('blocks the wrong role', () => { auth = { status: 'authenticated', user: { role: 'CUSTOMER' } }; renderAt('/admin'); expect(screen.getByText('not allowed')).toBeInTheDocument(); });
  it('allows the right role', () => { auth = { status: 'authenticated', user: { role: 'ADMIN' } }; renderAt('/admin'); expect(screen.getByText('admin area')).toBeInTheDocument(); });
});
