# Google measurement configuration

Manage GA4 and Search Console at **Admin → Integrations → Google measurement**. This card replaces generic API-key settings for the two reserved Google providers. Saving validates configuration; it does not pretend to verify Google collection or domain ownership.

- GA4 uses the existing web-stream measurement ID (`G-…`) and optional numeric property ID. No API key or OAuth token is needed for visitor measurement.
- Search Console can reference the verified Academy DNS domain property, or render a URL-prefix verification tag in the initial homepage HTML. DNS verification remains managed by Google/DNS.
- The public measurement API exposes only enabled state, measurement ID and required consent. All administrative reads and writes require the existing admin session.
- Enable GA only after confirming the stream URL is Academy and disabling Enhanced Measurement in Google. The application sends manual page views; automatic history, form, search and outbound-link collection must stay off.

## Consent and scope

The Google tag loads only after explicit optional-analytics acceptance by an anonymous visitor on `/`, `/login` or `/signup`. Consent expires after 180 days. Declining leaves Google unloaded. Preferences can revoke consent, stop the tag and clear only this feature's prefixed cookies. Admin and agent pages, password/reset/verification/SSO pages, form values and chat are excluded.

Page locations and same-site public referrers have every query and fragment removed. Titles are fixed. Advertising consent is denied, Google signals/personalization are disabled, and automatic page views are disabled. Public config refreshes within a minute while browser timers are active, with fail-closed handling of errors or disabled config.

The tag runs in an empty same-origin iframe so provider DOM/history listeners do not observe app forms and its timers can be destroyed on private navigation or withdrawal. This is lifecycle separation, not a security sandbox for untrusted JavaScript; only Google's gtag loader is permitted, without a GTM container.

## Search discovery

`/sitemap.xml` includes the public homepage only. `robots.txt` excludes private/auth/API/token URLs while allowing homepage assets and country data needed to render it. Initial HTML and response headers apply noindex to non-homepage SPA routes. Authenticated content remains protected by the existing authorization checks.

After deployment, submit `https://academy.findandstudy.com/sitemap.xml` in the existing Search Console property. Verify a consented anonymous homepage visit in the correct GA4 Realtime report before reporting collection as confirmed. Configuration status alone is insufficient.

## Validation

Run `npm run check`, `npm run build` and:

```sh
node --import tsx --test tests/google-measurement.test.ts server/google-measurement.test.ts server/google-measurement-routes.test.ts
```

The isolated browser provider fixture is `tests/google-measurement.browser.test.ts`; it intercepts every external URL and does not contact Google. All 23 supported languages have complete public/admin copy, checked by the unit suite.
