import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GuestRoute } from './ProtectedRoute.jsx';
import { loginTarget, registerTarget } from '../utils/postAuth.js';

let auth = { status: 'anonymous', user: null };
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));

const at = (target, entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/login" element={<GuestRoute target={target}><p>login form</p></GuestRoute>} />
      <Route path="/register" element={<GuestRoute target={target}><p>register form</p></GuestRoute>} />
      <Route path="/customer" element={<p>customer home</p>} />
      <Route path="/customer/bookings/5" element={<p>booking five</p>} />
      <Route path="/technician" element={<p>technician home</p>} />
      <Route path="/technician/application" element={<p>application form</p>} />
      <Route path="/admin" element={<p>admin home</p>} />
    </Routes>
  </MemoryRouter>);
const signedIn = (role) => { auth = { status: 'authenticated', user: { role } }; };

describe('GuestRoute: the single owner of post-login redirects', () => {
  it('shows the form to anonymous visitors and a loader while the session restores', () => {
    auth = { status: 'anonymous', user: null }; const { unmount } = at(loginTarget, '/login'); expect(screen.getByText('login form')).toBeInTheDocument(); unmount();
    auth = { status: 'loading', user: null }; at(loginTarget, '/login'); expect(screen.queryByText('login form')).toBeNull();
  });
  it('returns a signed-in customer to the page they originally asked for', () => {
    signedIn('CUSTOMER'); at(loginTarget, { pathname: '/login', state: { from: '/customer/bookings/5' } }); expect(screen.getByText('booking five')).toBeInTheDocument();
  });
  it('falls back to the role dashboard when there is no requested page', () => { signedIn('ADMIN'); at(loginTarget, '/login'); expect(screen.getByText('admin home')).toBeInTheDocument(); });
  it('never follows a requested page outside the signed-in role area', () => {
    signedIn('CUSTOMER'); at(loginTarget, { pathname: '/login', state: { from: '/admin' } }); expect(screen.getByText('customer home')).toBeInTheDocument();
  });
  it('sends a new technician to the application form after registering, a customer to the dashboard', () => {
    signedIn('TECHNICIAN'); const { unmount } = at(registerTarget, '/register'); expect(screen.getByText('application form')).toBeInTheDocument(); unmount();
    signedIn('CUSTOMER'); at(registerTarget, '/register'); expect(screen.getByText('customer home')).toBeInTheDocument();
  });
});

describe('loginTarget safety', () => {
  const u = { role: 'CUSTOMER' };
  it.each([
    ['https://evil.example/customer', '/customer'], ['//evil.example', '/customer'], ['/\\evil.example', '/customer'], ['/customerx', '/customer'],
    [undefined, '/customer'], [42, '/customer'],
  ])('request for %p is handled safely', (from, expected) => { expect(loginTarget(u, { state: { from } })).toBe(expected); });
  it('accepts paths and queries inside the role area', () => {
    expect(loginTarget(u, { state: { from: '/customer' } })).toBe('/customer');
    expect(loginTarget(u, { state: { from: '/customer/bookings/5' } })).toBe('/customer/bookings/5');
    expect(loginTarget(u, { state: { from: '/customer/book?serviceId=3' } })).toBe('/customer/book?serviceId=3');
  });
});
