import { z } from 'zod';
import { insertAgencySchema } from './schema';
import { COUNTRY_DIAL_CODES } from './country-dial-codes';

const countryCodes = new Set(COUNTRY_DIAL_CODES.map(country => country.code));

/** Only existing self-service fields; never accept an agency ID, status or logo approval. */
export const agentAgencyUpdateSchema = insertAgencySchema.pick({
  name: true, address: true, googleMapUrl: true, yandexMapUrl: true,
  staffSize: true, annualStudents: true, website: true, phone: true,
  primaryContactName: true, primaryContactEmail: true,
}).partial().extend({
  country: z.preprocess(value => typeof value === 'string' ? value.trim().toUpperCase() || null : value,
    z.string().refine(code => countryCodes.has(code), 'Invalid country code').nullable().optional()),
  city: z.string().trim().max(160).refine(city => !/[\u0000-\u001f\u007f]/.test(city), 'Invalid city')
    .nullable().optional().transform(city => city === '' ? null : city),
}).strict();
