# Apply → Academy profile handoff

Prepared locally; not deployed. No migration or bulk backfill.

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

Release requires the separately approved Apply issuer change. Deploy receiver
first, issuer second, with verified fresh DB/storage backup and application
rollback copies. No production change, test account mutation, mail send or live
acceptance test was performed for this fix. After approval, test a fresh
synthetic account through real SSO, repeat it, and verify the pre-existing test
account's completed values are preserved. Restore code only on failure; do not
restore an old DB snapshot over new live activity.
