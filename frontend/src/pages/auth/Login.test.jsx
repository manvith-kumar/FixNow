import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login.jsx';

// A plain function (not a vi.fn spy) is used for `login`: spies that wrap rejecting async functions
// can surface the rejection as an "unhandled" error in the runner even though the component handles it.
let impl; let calls;
const login = (...args) => { calls.push(args); return impl(...args); };
vi.mock('../../context/AuthContext.jsx', () => ({ useAuth: () => ({ login: (...a) => login(...a), notice: '' }) }));
beforeEach(() => { calls = []; impl = async () => ({ role: 'CUSTOMER' }); });
const setup = (state) => render(<MemoryRouter initialEntries={[{ pathname: '/login', state }]}><Routes><Route path="/login" element={<Login />} /><Route path="/customer" element={<p>customer home</p>} /><Route path="/customer/bookings/5" element={<p>booking five</p>} /><Route path="/admin" element={<p>admin home</p>} /></Routes></MemoryRouter>);
const fill = async (email, pw) => { await userEvent.type(screen.getByLabelText(/Email/), email); await userEvent.type(screen.getByLabelText(/Password/), pw); await userEvent.click(screen.getByRole('button', { name: 'Log in' })); };

describe('Login page', () => {
  it('validates before calling the API', async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument(); expect(screen.getByText('Enter your password.')).toBeInTheDocument(); expect(calls).toHaveLength(0);
  });
  it('calls login with the typed credentials (the redirect afterwards is owned by GuestRoute, see GuestRoute.test.jsx)', async () => {
    setup(); await fill('admin@fixnow.test', 'Password@123');
    await waitFor(() => expect(calls[0]).toEqual(['admin@fixnow.test', 'Password@123']));
  });
  it('shows the server error and stays on the page when login fails', async () => {
    impl = async () => { throw { response: { status: 401, data: { error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' } } } }; };
    setup(); await fill('c@x.io', 'wrong');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password'));
    expect(screen.queryByText('customer home')).toBeNull();
  });
});
