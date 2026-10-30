# Apply → Academy profile handoff

Deployed with owner approval at 2026-10-30 11:43:29 UTC, product commit
`5c346027ddada93913ef2a3bb9f59f029d8ccb7f`. No new migration or bulk backfill.

The signed SSO profile now normalizes legacy English/Turkish country names to
ISO codes. An exact external-ID-linked active agent can fill blank personal
company/country/phone fields. Existing nonblank fields, roles, status and shared
agency records remain unchanged. A complete agent without an agency receives
an independent agency in the same row-locked transaction as the user link.
Agency names never establish membership. Missing/invalid input continues to
require profile completion. Existing incomplete shared agencies still require
their normal completion workflow; this release does not rewrite them.

The change is wired after JWT verification and inactive-user denial, before
device/session establishment. Existing first-user provisioning concurrency and
email/external-ID matching behavior are outside this change; the four-way SQL
test covers hydration of one already-provisioned user, not simultaneous first
account creation.

Validation: 10 focused Academy tests plus 3 Apply claim tests pass. Selected
Academy regression run passes 31 tests (overlapping focused tests). Real local
PostgreSQL 16.15 with a non-superuser/non-bypass runtime role proves completion,
four-way hydration concurrency, repeat preservation, injected rollback and
identity denial. Fixture schema/role were removed and cluster stopped.
Academy typecheck, translations, client and server builds pass.

## Live acceptance

Receiver deployed first, issuer second. Apply user 3733 / agent 1276 reached the
Academy dashboard on first SSO without the completion form. Business-name
fallback persisted as company/agency name and United States normalized to US.
Second SSO reused exactly the same Academy user and agency. The prior synthetic
account's completed country, phone, agency relationship/contact fields,
role/status and stable identity were unchanged; only its blank company field
was filled. Test records were retained. Both admin sessions were restored.
Password-based login and email delivery were not tested in this release.

At 11:47:56 UTC, both health endpoints returned 200/ok, deployed file hashes
matched, bounded post-release logs contained zero SSO/fatal markers, and all
46 unrelated containers retained their identity/start time/state. Fresh verified
custom-format DB backups (7,715,869,328 and 135,302,319 bytes), a verified 7,010-file
storage archive and application rollback copies remain root-private at
`/srv/academy-sso-20261030-0a791d0-5c34602`. The first timed-out dump is explicitly
marked incomplete and is not a valid backup. No DNS change or extra worker start.
Restore code only on failure; never restore an old DB over new live activity.
