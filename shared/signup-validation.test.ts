import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicSignupSchema } from './signup-validation';

const valid = { name: 'Test Agent', email: '  TEST@example.com ', password: 'valid-test-password', agencyName: 'Test Agency', country: 'tr', phone: '+90 555 000 0000', languagePreference: 'ur' };

test('signup normalizes email, names, country and phone while preserving chosen language', () => {
  const value = publicSignupSchema.parse(valid);
  assert.equal(value.email, 'test@example.com');
  assert.equal(value.country, 'TR');
  assert.equal(value.phone, '+905550000000');
  assert.equal(value.languagePreference, 'ur');
  assert.equal(value.password, valid.password);
});

test('signup rejects malformed contact data, weak passwords and privilege fields', () => {
  for (const patch of [{ name: ' ' }, { email: 'invalid' }, { password: '123' }, { agencyName: '' }, { country: 'XX' }, { phone: '+0000000' }, { languagePreference: 'xx' }, { role: 'admin' }]) {
    assert.equal(publicSignupSchema.safeParse({ ...valid, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.equal(publicSignupSchema.safeParse({ ...valid, password: '密'.repeat(30) }).success, false);
});
