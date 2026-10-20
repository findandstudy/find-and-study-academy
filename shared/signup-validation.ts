import { z } from 'zod';
import { COUNTRY_DIAL_CODES } from './country-dial-codes';
import { isSupportedLanguage } from './languages';
import { EMAIL_ATTRIBUTION_TOKEN_MAX_LENGTH } from './email-attribution';

const countries = new Set(COUNTRY_DIAL_CODES.map(country => country.code));

export const publicSignupSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Use at least 8 characters for your password').max(72)
    .refine(password => new TextEncoder().encode(password).length <= 72, 'Password must be at most 72 UTF-8 bytes'),
  agencyName: z.string().trim().min(2, 'Agency name is required').max(180),
  country: z.string().trim().toUpperCase().refine(country => countries.has(country), 'Invalid country code'),
  phone: z.string().transform(phone => phone.replace(/\s+/g, ''))
    .refine(phone => /^\+[1-9]\d{5,17}$/.test(phone), 'Invalid phone number'),
  languagePreference: z.string().refine(isSupportedLanguage, 'Unsupported language').default('en'),
  // Optional analytics must never make an otherwise valid signup fail.
  emailAttributionToken: z.preprocess(value => typeof value === 'string' && value.length <= EMAIL_ATTRIBUTION_TOKEN_MAX_LENGTH ? value : undefined, z.string().max(EMAIL_ATTRIBUTION_TOKEN_MAX_LENGTH).optional()),
}).strict();
