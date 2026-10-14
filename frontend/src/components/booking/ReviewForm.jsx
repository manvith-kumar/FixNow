import { useState } from 'react';
import { reviewsApi } from '../../api/index.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { Alert, Button, StarInput, TextareaField } from '../ui/index.js';

export function ReviewForm({ booking, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const submit = useSubmit(async () => { await reviewsApi.create({ bookingId: booking.id, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }); onDone(); });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!rating) { setErr('Choose a star rating.'); return; } setErr(''); submit.run(); }} noValidate>
      <div className="field"><span className="label">Your rating</span><StarInput value={rating} onChange={setRating} />{err && <span className="field-error" role="alert">{err}</span>}</div>
      <TextareaField label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} hint="Public reviews show your first name only." />
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
      <Button type="submit" variant="primary" busy={submit.busy}>Submit review</Button>
    </form>
  );
}
