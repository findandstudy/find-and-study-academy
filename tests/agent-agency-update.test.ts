import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentAgencyUpdateSchema } from '../shared/agency-update';
import { WORLD_COUNTRIES } from '../client/src/lib/world-countries';

test('self-service country and city normalize without changing other profile fields', () => {
  assert.deepEqual(agentAgencyUpdateSchema.parse({ country: ' tr ', city: ' İstanbul ', name: 'Example Agency' }), {
    country: 'TR', city: 'İstanbul', name: 'Example Agency',
  });
  assert.deepEqual(agentAgencyUpdateSchema.parse({ country: '', city: '  ' }), { country: null, city: null });
  assert.deepEqual(agentAgencyUpdateSchema.parse({ country: null, city: null }), { country: null, city: null });
});

test('every offered country is accepted by the same server contract', () => {
  for (const country of WORLD_COUNTRIES) {
    assert.equal(agentAgencyUpdateSchema.safeParse({ country: country.code }).success, true, country.code);
  }
});

test('partial updates leave historical country names untouched', () => {
  const stored = { country: 'Legacy country label', city: 'Existing city', status: 'approved' };
  const update = agentAgencyUpdateSchema.parse({ phone: '+905551234567' });
  assert.deepEqual({ ...stored, ...update }, { ...stored, phone: '+905551234567' });
  assert.equal(Object.hasOwn(update, 'country'), false);
  assert.equal(Object.hasOwn(update, 'city'), false);
});

test('malformed countries, oversized cities and control characters are rejected', () => {
  for (const country of ['XX', 'Turkey', 'USA', 123, {}, ['TR']]) {
    assert.equal(agentAgencyUpdateSchema.safeParse({ country }).success, false);
  }
  for (const city of ['x'.repeat(161), 'City\nInjected', 'City\u0000name', 123]) {
    assert.equal(agentAgencyUpdateSchema.safeParse({ city }).success, false);
  }
});

test('self-service cannot supply another agency identity, status, ownership or approval fields', () => {
  for (const key of ['id', 'agencyId', 'userId', 'status', 'countryCode', 'logoUrl', 'approvedAt', 'createdAt', 'adminNotes']) {
    assert.equal(agentAgencyUpdateSchema.safeParse({ city: 'Ankara', [key]: 'other-agency' }).success, false, key);
  }
});
