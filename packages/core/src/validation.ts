import { z } from 'zod';
import { isValidHHMM, isValidTimeZone } from './dates';
import type { Weekday } from './types';

/** Shared request validation for web forms, the API and the mobile app. */

const weekday = z.custom<Weekday>((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6, 'Invalid weekday');
const hhmm = z.string().refine(isValidHHMM, 'Use a 24-hour time like 09:30');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-03-04');

export const cadenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily'), postsPerDay: z.number().int().min(1).max(20) }),
  z.object({
    kind: z.literal('days'),
    days: z.array(weekday).min(1, 'Pick at least one day').max(7),
    postsPerDay: z.number().int().min(1).max(20),
  }),
  z.object({ kind: z.literal('weekly'), postsPerWeek: z.number().int().min(1).max(100) }),
]);

export const pauseSchema = z
  .object({ start: isoDate, end: isoDate, note: z.string().max(120).nullish() })
  .refine((p) => p.start <= p.end, { message: 'A break must end on or after its start date', path: ['end'] });

export const settingsSchema = z.object({
  cadence: cadenceSchema,
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  pauses: z.array(pauseSchema).max(50),
  reminders: z.object({
    enabled: z.boolean(),
    time: hhmm,
    days: z.array(weekday).max(7),
    quietHours: z.object({ start: hhmm, end: hhmm }).nullable(),
  }),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Tell us what to call you').max(80),
  email: z.email('Enter a valid email').max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
});

export const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
