import { z } from 'zod';
import { text, latitude, longitude } from './common.js';

export const addressBody = z.object({
  label: text(50, 1).default('Home'), line1: text(190, 3), line2: text(190).optional(), city: text(100, 2), state: text(100).optional(),
  postalCode: text(20).optional(), country: text(80, 2).default('India'),
  latitude: latitude.nullable().optional(), longitude: longitude.nullable().optional(), isDefault: z.boolean().optional(),
}).strict().refine((d) => (d.latitude == null) === (d.longitude == null), { message: 'Provide both latitude and longitude, or neither', path: ['latitude'] });
export const addressUpdate = z.object({
  label: text(50, 1), line1: text(190, 3), line2: text(190).nullable(), city: text(100, 2), state: text(100).nullable(),
  postalCode: text(20).nullable(), country: text(80, 2), latitude: latitude.nullable(), longitude: longitude.nullable(), isDefault: z.boolean(),
}).partial().strict();
