import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, Modal, ReasonDialog } from './Modal.jsx';

describe('dialogs', () => {
  it('closes on Escape and exposes dialog semantics', async () => {
    const onClose = vi.fn();
    render(<Modal open title="Hello" onClose={onClose}><button>inside</button></Modal>);
    expect(screen.getByRole('dialog', { name: 'Hello' })).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}'); expect(onClose).toHaveBeenCalled();
  });
  it('ConfirmDialog calls onConfirm once and shows a failure message', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Server said no'));
    render(<ConfirmDialog open title="Approve?" confirmLabel="Do it" onConfirm={onConfirm} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(await screen.findByText('Server said no')).toBeInTheDocument(); expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it('ReasonDialog requires a reason of the minimum length', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<ReasonDialog open title="Reject" minLength={5} confirmLabel="Send" onSubmit={onSubmit} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText(/at least 5 characters/)).toBeInTheDocument(); expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Reason/), 'Too expensive');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Too expensive'));
  });
});

describe('Modal stability', () => {
  it('does not steal focus or re-run when the parent re-renders with a new onClose', async () => {
    const { rerender } = render(<Modal open title="T" onClose={() => {}}><input aria-label="a" /><input aria-label="b" /></Modal>);
    const b = screen.getByLabelText('b'); b.focus(); expect(document.activeElement).toBe(b);
    rerender(<Modal open title="T" onClose={() => {}}><input aria-label="a" /><input aria-label="b" /></Modal>);
    expect(document.activeElement).toBe(b);
  });
  it('releases the page scroll lock when closed, even after re-renders', () => {
    const { rerender, unmount } = render(<Modal open title="T" onClose={() => {}}><p>x</p></Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Modal open title="T" onClose={() => {}}><p>x</p></Modal>);
    rerender(<Modal open={false} title="T" onClose={() => {}}><p>x</p></Modal>);
    expect(document.body.style.overflow).toBe(''); unmount();
  });
});
