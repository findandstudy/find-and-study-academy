# Email campaign attribution

Manage the report at **Admin → Invitation campaigns → Email performance**. It compares the five messages in English and Turkish, separately or with languages combined. Rows rank by recorded registrations. Date filters are inclusive UTC dates: visits use visit time, promo registrations use redemption time for both attributed and unknown sources, and standard registrations use their recording time. Campaign filters affect registrations; visits cover the whole email series, so no misleading conversion percentage is computed.

The report distinguishes attributed registrations, attributed promo registrations, pending approval, active/approved accounts, and promo registrations without an email source. The all-promo total includes attributed and unattributed accounts, independent of the language display filter. Historical sources are never inferred.

## Link contract

Only this exact finite tuple is recognized:

- `utm_source=newsletter`
- `utm_medium=email`
- `utm_campaign=academy_launch_2026`
- `utm_content=email_01_en` through `email_05_en`, or `email_01_tr` through `email_05_tr`

The existing signup CTAs already contain these values. The updated email package also tags the Academy homepage footer link and carries `promo=ACADEMY2026` into the signup journey. Public navigation reconstructs only allowed campaign values; arbitrary query strings, recipient identifiers and raw promo codes are never sent to Google or the visit endpoint. Do not add email addresses or recipient-specific IDs to links.

## Consent and counting

Source data is persisted only for an anonymous visitor on the public homepage/sign-in/signup pages after optional analytics consent and while measurement is enabled. An explicit tagged entry creates one measured visit per message/browser within 30 minutes. Direct returns retain the last valid source for up to 30 days without creating another email visit. Visits are not email opens or unique people. Withdrawal clears browser attribution and prevents further collection.

The first-party visit service issues a signed receipt bound to the original persisted visit and its expiry. A successful normal or promo signup may submit this optional receipt. Only an already committed account can receive one attribution record; failures, verification-code requests, clicks and duplicate signup attempts do not count. Invalid or expired receipts are ignored. Optional attribution errors cannot reject a valid account registration.

Google receives only canonical campaign metadata and `sign_up` with `method=promo` or `method=standard` after server success. It receives no email, account ID, receipt, visit ID, form values or raw URL query. The GA4 `sign_up` key event is configured without an invented monetary value. Administrator approval is a later state and does not create a second registration conversion.

## Deployment

Apply the additive SQL in `server/email-attribution.sql` once before publishing this version. It creates only `academy_email_visits` and `academy_email_registrations` with their indexes and constraints; it does not backfill or modify existing accounts/campaign memberships. `assertEmailAttributionReady` verifies the expected schema. Keep `SESSION_SECRET` in the existing protected server configuration; no new credentials are needed.

The database is the administrative registration-count source of truth. GA4 remains a consent-dependent secondary analytics view, so totals may differ when visitors reject analytics or block Google. Unattributed promo accounts remain visible in the administrative totals.

Validation covers canonical/hostile parameters, consent and withdrawal, idempotent visits, receipt expiry/tampering, success-only registrations, report access/date filters, language aggregation and all 23 interface languages. Production SQL fixtures must run inside a transaction and roll back without sending email or creating persistent test accounts.
