import { z } from 'zod';

export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const email = z.string().trim().toLowerCase().email().max(190);
export const password = z.string().min(8, 'Password must be at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a digit');
export const phone = z.string().trim().regex(/^[+]?[\d\s\-()]{7,20}$/, 'Enter a valid phone number');
export const text = (max, min = 0) => z.string().trim().min(min).max(max);
export const decimalStr = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
export const boolish = z.preprocess((v) => (v === 'true' || v === true || v === 1 || v === '1' ? true : v === 'false' || v === false || v === 0 || v === '0' ? false : v), z.boolean());
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');
export const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM').transform((s) => (s.length === 5 ? `${s}:00` : s));
export const latitude = z.coerce.number().min(-90).max(90);
export const longitude = z.coerce.number().min(-180).max(180);
export const search = z.string().trim().max(100).optional();
