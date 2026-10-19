import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {destinationLabel,formatCampaignDeadline,isInvitationCode,normalizeInvitationCode,readCampaignOffer,readTrainingDestinations,startCampaignPreview,type CampaignPreview} from '../client/src/lib/homepage-data';

const response = (accessDays = 180) => ({success: true, campaign: {
  accessDays, expiresAt: '2026-11-16T20:59:00.000Z', deviceLimit: 2,
  emailVerificationRequired: true, administratorApprovalRequired: true,
}});
const ok = (body: unknown) => new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json'}});

test('coverage excludes introduction and invalid codes, deduplicates and preserves email order before future destinations', () => {
  const countries = [
    {code: '', name: 'Find And Study introduction'}, {code: 'USA', name: 'Invalid'}, {code: '1A', name: 'Invalid'},
    {code: 'US', name: 'United States'}, {code: 'GB', name: 'United Kingdom'},
    {code: 'nz', name: 'New Zealand'}, {code: 'AZ', name: 'Azerbaijan'},
    {code: ' az ', name: 'Duplicate'}, {code: 'AU', name: 'Australia'}, null,
  ];
  assert.deepEqual(readTrainingDestinations({success: true, countries}), [
    {code: 'AZ', name: 'Azerbaijan'}, {code: 'GB', name: 'United Kingdom'}, {code: 'US', name: 'United States'},
    {code: 'AU', name: 'Australia'}, {code: 'NZ', name: 'New Zealand'},
  ]);
  assert.equal(readTrainingDestinations({success: false, countries}), null);
  assert.equal(readTrainingDestinations({success: true, countries: {}}), null);
  assert.deepEqual(readTrainingDestinations({success: true, countries: []}), []);
});

test('country labels use explicit catalog translations, then localized regions and safe API fallback', () => {
  assert.equal(destinationLabel({code: 'TR', name: 'API name'}, 'tr', 'Türkiye'), 'Türkiye');
  assert.equal(destinationLabel({code: 'DE', name: 'API name'}, 'tr'), 'Almanya');
  const displayNames = Intl.DisplayNames;
  try {
    Intl.DisplayNames = class {constructor() { throw new Error('unavailable'); }} as typeof Intl.DisplayNames;
    assert.equal(destinationLabel({code: 'NZ', name: 'New Zealand'}, 'tr'), 'New Zealand');
  } finally { Intl.DisplayNames = displayNames; }
});

test('invitation normalization preserves signup shape and rejects malformed input before requesting', async () => {
  assert.equal(normalizeInvitationCode('  invite-123  '), 'INVITE-123');
  for (const invalid of ['', 'SHORT', 'SPACE CODE', 'A'.repeat(65), 'CODE_123', '漢字CODE', 'ßßß', 'ſſſſſſ']) assert.equal(isInvitationCode(normalizeInvitationCode(invalid)), false);
  assert.equal(isInvitationCode('INVITE-123'), true);
  const states: CampaignPreview[] = [];
  let requests = 0;
  const cancel = startCampaignPreview('SHORT', state => states.push(state), async () => { requests++; return ok(response()); }, 0);
  await delay(5);
  cancel();
  assert.equal(requests, 0);
  assert.deepEqual(states, [{status: 'idle', promoCode: 'SHORT'}]);
});

test('only complete successful server offers are accepted', () => {
  assert.equal(readCampaignOffer(response())?.accessDays, 180);
  for (const patch of [{accessDays: 0}, {accessDays: 1.5}, {accessDays: '180'}, {expiresAt: 'bad-date'}, {deviceLimit: 3}, {emailVerificationRequired: false}, {administratorApprovalRequired: false}]) {
    const invalid = {...response(), campaign: {...response().campaign, ...patch}};
    assert.equal(readCampaignOffer(invalid), null, JSON.stringify(patch));
  }
  assert.equal(readCampaignOffer({success: false, campaign: response().campaign}), null);
  assert.equal(readCampaignOffer({success: true}), null);
});

test('preview debounces and sends only a credential-free read-only confirmation request', async () => {
  const states: CampaignPreview[] = [];
  const requests: {url: RequestInfo | URL; init?: RequestInit}[] = [];
  const cancel = startCampaignPreview('INVITE-123', state => states.push(state), async (url, init) => {
    requests.push({url, init});
    return ok(response());
  }, 30);
  assert.equal(states[0]?.status, 'checking');
  await delay(10);
  assert.equal(requests.length, 0);
  await delay(40);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/public/campaign-preview');
  assert.equal(requests[0].init?.method, 'POST');
  assert.equal(requests[0].init?.credentials, 'omit');
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {promoCode: 'INVITE-123'});
  assert.equal(states.at(-1)?.status, 'confirmed');
  cancel();
});

test('cancelling while typing prevents a request and obsolete responses cannot restore old offers', async () => {
  let requests = 0;
  const cancelled = startCampaignPreview('CANCEL-123', () => {}, async () => { requests++; return ok(response()); }, 15);
  cancelled();
  await delay(25);
  assert.equal(requests, 0);

  const states: CampaignPreview[] = [];
  const resolvers: ((response: Response) => void)[] = [];
  const signals: AbortSignal[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    signals.push(init!.signal!);
    return await new Promise<Response>(resolve => resolvers.push(resolve));
  };
  const cancelOld = startCampaignPreview('OLD-123', state => states.push(state), fetcher, 0);
  await delay(5);
  cancelOld();
  assert.equal(signals[0].aborted, true);
  const cancelNew = startCampaignPreview('NEW-123', state => states.push(state), fetcher, 0);
  await delay(5);
  resolvers[1](ok(response(90)));
  await delay(5);
  resolvers[0](ok(response(180)));
  await delay(5);
  const confirmations = states.filter(state => state.status === 'confirmed');
  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0]?.promoCode, 'NEW-123');
  assert.equal(confirmations[0]?.status === 'confirmed' && confirmations[0].campaign.accessDays, 90);
  cancelNew();
});

test('invalid, failed and unreadable responses never produce a confirmed offer', async () => {
  for (const fetcher of [
    async () => ok({success: false}),
    async () => new Response('{}', {status: 503}),
    async () => new Response('not-json'),
    async () => {throw new Error('offline');},
  ]) {
    const states: CampaignPreview[] = [];
    const cancel = startCampaignPreview('INVITE-123', state => states.push(state), fetcher, 0);
    await delay(5);
    assert.deepEqual(states.map(state => state.status), ['checking', 'unavailable']);
    cancel();
  }
});

test('hung requests time out, abort and ignore late results, while cleanup clears the timeout', async () => {
  const states: CampaignPreview[] = [];
  let signal: AbortSignal | undefined;
  let resolveRequest: (response: Response) => void = () => {};
  const cancel = startCampaignPreview('INVITE-123', state => states.push(state), async (_url, init) => {
    signal = init!.signal!;
    return await new Promise<Response>(resolve => {resolveRequest = resolve;});
  }, 0, 15);
  await delay(30);
  assert.equal(signal?.aborted, true);
  assert.deepEqual(states.map(state => state.status), ['checking', 'unavailable']);
  resolveRequest(ok(response()));
  await delay(5);
  assert.deepEqual(states.map(state => state.status), ['checking', 'unavailable']);
  cancel();

  const cancelledStates: CampaignPreview[] = [];
  const cancelPending = startCampaignPreview('INVITE-123', state => cancelledStates.push(state), async () => await new Promise<Response>(() => {}), 0, 15);
  await delay(5);
  cancelPending();
  await delay(25);
  assert.deepEqual(cancelledStates.map(state => state.status), ['checking']);

  const successfulStates: CampaignPreview[] = [];
  const cancelSuccess = startCampaignPreview('INVITE-123', state => successfulStates.push(state), async () => ok(response()), 0, 15);
  await delay(30);
  assert.deepEqual(successfulStates.map(state => state.status), ['checking', 'confirmed']);
  cancelSuccess();
});

test('deadline remains 16 November 2026 at 23:59 in Türkiye across locale and Intl failures', () => {
  const expiry = response().campaign.expiresAt;
  assert.match(formatCampaignDeadline(expiry, 'en'), /November 16, 2026 at 23:59/);
  assert.match(formatCampaignDeadline(expiry, 'tr'), /16 Kasım 2026 23:59/);
  assert.match(formatCampaignDeadline(expiry, 'fa'), /۲۰۲۶/);
  assert.match(formatCampaignDeadline(expiry, 'not_a_locale'), /November 16, 2026 at 23:59/);
  const formatter = Intl.DateTimeFormat;
  try {
    Intl.DateTimeFormat = class {constructor() {throw new Error('unavailable');}} as typeof Intl.DateTimeFormat;
    assert.equal(formatCampaignDeadline(expiry, 'tr'), '2026-11-16 23:59');
  } finally { Intl.DateTimeFormat = formatter; }
});
