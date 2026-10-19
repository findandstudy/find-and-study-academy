# Homepage and campaign information

The public homepage describes learning, grounded Findy guidance, reusable Partner Zone materials and the separate partnership application. Existing typography, navy/red colors and layout patterns are retained.

## Data and language behavior

- All 23 supported languages contain 129 homepage strings.
- Destination coverage comes from the public countries API. Introductory content is excluded, valid destination codes are deduplicated, and labels are localized. The verified publication contained 16 training destinations.
- Supported language names come from the shared language registry. Training destinations and active Apply catalogue coverage are explicitly distinguished.
- Partner orientation is described in the selected language instead of using the English word “onboarding”. Localized hero questions address agencies and consultants.

## Campaign preview

`POST /api/public/campaign-preview` validates a supplied code and returns only access duration, expiry, device limit and verification/approval requirements. It is read-only, has a separate 30-request/minute limit, and returns `Cache-Control: no-store`. It does not reserve campaign access or change registration, account approval or membership.

The frontend debounces requests, aborts stale requests, hides old offers immediately when the input changes, and uses Türkiye time with a Gregorian calendar for deadlines. A valid invitation is normalized before registration handoff. Generic campaign copy remains when no confirmed code is supplied.

## Validation

- TypeScript and production builds, including the interface translation gate.
- Nine homepage data/request lifecycle tests: `node --import ./node_modules/tsx/dist/loader.mjs --test tests/homepage-data.test.ts`.
- Twenty-two isolated HTTP preview checks: `node tests/campaign-preview-api.test.cjs`.
- Live checks for localized headings, 16 destinations, 23 language labels, RTL, mobile overflow, campaign terms, invalid/stale offers, FAQ and logo preview controls.

Production publication uses source and configuration hashes, preserves unrelated files, retains previous fingerprinted chunks and creates a rollback backup. No registration or email delivery is performed by these checks.
